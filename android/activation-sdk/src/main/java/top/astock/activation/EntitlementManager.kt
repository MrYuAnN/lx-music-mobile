/*
 * 权益状态机（自净屏 M3 抽取；决策 #5/#7：无账号 key + 服务端 receipt）
 * 基于 RethinkDNS (Apache-2.0) 二次开发
 *
 * 状态：Unactivated（未激活）/ Active（会员，exp=0 永久）/ Expired（到期）。
 * receipt 由平台服务密钥签发，本地 Ed25519 验签（公钥未配置时跳过验签）。
 *
 * 时钟回拨防护（审查 I-2）：last_seen 单调时间戳与 receipt 一起存 SharedPreferences，
 * 用 Android Keystore HMAC 做完整性保护——被篡改即整体判 Unactivated（fail-safe）；
 * 到期判定用 effectiveNow = max(系统时间, last_seen)，回拨无法把到期时间倒回去。
 *
 * 服务端权威：refreshOnStart() 重放 activate 刷新 receipt；网络失败保留本地态
 * （离线宽限语义）；403 已吊销/无效清权（人工收权），已过期不清码——2026-08-27
 * 拍板：自然过期保留记录至续费，展示层按 per-app 到期即时变红。
 *
 * 配置：apiBase/productId/deviceSalt/servicePubkeyHex 等由宿主经 ActivationSdk.init()
 * 注入（单源见 ActivationSdk），本类不持有任何宿主专属常量。
 */
package top.astock.activation

import android.content.Context
import android.util.Base64
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.KeyGenerator
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

object EntitlementManager {

    private const val TAG = "EntitlementMgr"
    private const val PREFS = "jingping"
    private const val K_DEVICE_ID = "device_id"
    private const val K_LICENSE_KEY = "license_key"   // 旧单码（迁移源）
    private const val K_RECEIPT = "receipt_json"      // 旧单码 receipt（迁移源）
    // 多 key 存储（2026-08-22 拍板：每 App 一个码）：app→key 归属映射 + key→receipt
    private const val K_APP_KEYS = "app_keys_json"    // {"fanqie":"JP-A","hongguo":"JP-B"}
    private const val K_RECEIPTS = "receipts_json"    // {"JP-A":{...},"JP-B":{...}}
    private const val K_PRIMARY = "primary_key"       // 最近激活的 key（CZ- 充值目标）
    private const val K_LAST_SEEN = "last_seen"
    private const val K_MAC = "state_mac"
    // 绑定态标记（2026-08-27 三态模型）：{"JP-A":"unbound"|"bound_other"}；缺省=本机绑定中。
    // 仅作展示与本地停权过滤，服务端 /api/binding-check 是唯一权威且巡检会持续重写，
    // 故不纳入 state MAC。BindingSelf 用「无条目」表达（免恒写）。
    private const val K_KEY_BINDING = "key_binding_json"
    const val BINDING_MARK_UNBOUND = "unbound"        // 无任何在绑设备（解绑后）
    const val BINDING_MARK_OTHER = "bound_other"      // 已被其它手机绑定
    const val BINDING_INTENT_BIND = "bind"            // /activate intent：用户主动绑定

    // binding-check 巡检节流（2026-08-27 方案A'）：onResume 级调用压平到 3 分钟一次，
    // 防再打穿服务端 /IP/日 配额。显式通道——码详情页打开 bindingCheckNow / 绑定本机 /
    // 输码激活——不经此路径不受限，实时性不受影响。失败也计入窗口（防 429 风暴重试）。
    @Volatile
    private var lastBindingCheckAt = 0L
    private const val BINDING_CHECK_MIN_INTERVAL_MS = 3 * 60_000L
    const val K_PRIVACY_CONSENTED = "privacy_consented"

    private const val KEYSTORE_ALIAS = "jingping_state_mac"
    private val markLock = Any() // 绑定态标记 dict 读改写互斥（审查 O-S3）
    private const val ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000L

    // 首启免费试用 claim（2026-10-13 拍板）节流键：非权益数据不进 state MAC。
    // 退避序列 10s→5min→30min→6h 封顶（失败累计；请求前先记时间防 429 风暴）。
    // 首档 10s（2026-10-14 拍板③）：无网/失败首启的回前台快速自愈。
    private const val K_TRIAL_FAILS = "trial_claim_fails"
    private const val K_TRIAL_LAST = "trial_claim_last_at"
    private const val K_TRIAL_DONE = "trial_claim_done"   // 命中原码已过期（购买墙）后不再空转
    private const val K_TRIAL_PENDING = "trial_welcome_pending" // 首启资格待弹（Application 前置判定）
    private const val K_TRIAL_WELCOMED = "trial_welcomed"       // 资格卡已弹过（弹一次）
    private val TRIAL_BACKOFF_MS = longArrayOf(10_000L, 5 * 60_000L, 30 * 60_000L, 6 * 3_600_000L)

    /** 试用 tier 契约字面量（与平台仓 store.TrialTier 同串；跨端无共享包，改动必须成对）。
     *  2026-10-15 组1 块4 起降级为过渡回落（kind 缺失时比对），与过渡分支同批退役
     *  （退役条件：entitlement_kind 全端覆盖两个发版周期后删除本常量与回落分支）。 */
    const val TRIAL_TIER = "auto3"

    /** 体验卡（付费试用卡 trial7/trial3）tier 名单单源（2026-10-24 体验卡禁自助解绑；
     *  与平台仓 store.isTrialCardTier 同名单，跨端无共享包，改动必须成对）。
     *  服务端对体验卡禁自助解绑（一码一用锁首绑设备，跨设备轮薅防线），UI 据此
     *  隐藏解绑入口。注意与 TRIAL_TIER（auto3 首启免费试用）是两套体系——
     *  isTrial() 判的是后者，勿混用。 */
    fun isTrialCardTier(tier: String): Boolean = tier == "trial7" || tier == "trial3"

    /** 权益类型语义（组1 块3 契约字段，平台 activationResp 顶层 entitlement_kind 下发；
     *  值域=平台 entitlementKind 函数单源（trial/paid，对标 RevenueCat periodType 裁剪）。
     *  本常量为 App 侧单点字面量，非跨端比对（跨端比对已由 kind 语义化消灭）。 */
    const val KIND_TRIAL = "trial"
    // 双入口并发去重（审查 S2）：冷启动/resumeCore/Worker 三触发点可并发进入，
    // K_TRIAL_LAST 读-写非原子（SP apply 异步）——in-flight 标志保证单飞。
    // tryBegin/endClaim 抽出（组1 块4 测试 seam）：单飞语义纯 JVM 可测。
    private val trialInFlight = java.util.concurrent.atomic.AtomicBoolean(false)

    internal fun tryBeginClaim(): Boolean = trialInFlight.compareAndSet(false, true)
    internal fun endClaim() { trialInFlight.set(false) }

    // I9（审查）：current() 进程内短缓存——per-app 化后调用点从集中式分散为每卡
    // 状态行/横幅/剪贴板 chip/开关回填，onResume 一帧曾串行 7 次 current() = 14 次
    // Keystore HMAC binder IPC + 14 次写盘，主线程帧预算不可承受（Guardsquare：
    // Never call Android Keystore on the main thread）。2s TTL 足以合并同帧调用；
    // persist/clear/refreshOnStart 后失效，权益变更即时生效。
    private var cachedState: State? = null
    private var cachedStateAt = 0L
    private const val STATE_CACHE_TTL_MS = 2000L
    private var lastSeenWriteAt = 0L
    private const val LAST_SEEN_THROTTLE_MS = 60_000L

    fun invalidateStateCache() {
        cachedState = null
        cachedStateAt = 0L
    }

    /**
     * per-app 权益（决策 #6：{app: expiry}，0 = 永久）。
     * apps = expiries 的 key 集合；v1 老 receipt 本地展开为各 app 同值（离线老用户自愈）。
     */
    data class Entitlement(
        val keyId: String,
        val expiries: Map<String, Long>, // app → unix 秒；0 = 永久
        val tier: String,
        val deviceLimit: Int,
        // 权益类型语义（组1 块3）：服务端 entitlement_kind 下发的「是否试用档」真源；
        // 空串=旧持久化/旧服务端（过渡期按 tier==TRIAL_TIER 回落，见 isTrialEntitlement）
        val kind: String = "",
    ) {
        val apps: List<String> get() = expiries.keys.toList()

        /** 是否试用档（组1 块4：语义化判定单源——kind 优先，缺失回落 tier 比对过渡） */
        fun isTrial(): Boolean = kind == KIND_TRIAL || (kind.isEmpty() && tier == TRIAL_TIER)
    }

    sealed class State {
        object Unactivated : State()
        data class Active(val e: Entitlement) : State()
        data class Expired(val e: Entitlement) : State()
    }

    /** 绑定设备行（2026-08-27 设备管理面板）：deviceId 为完整盐化哈希，仅持码方可经
     *  /api/binding-check 获取，暴露面与 key 本身等同 */
    data class BoundDevice(
        val deviceId: String,
        val deviceName: String,
        val boundAt: Long,
        val isSelf: Boolean,
    )

    /** 单码绑定态快照：mark 同 bindingState 口径（null=本机在绑）；devices=当前在绑设备 */
    data class BindingInfo(val mark: String?, val devices: List<BoundDevice>)

    sealed class AuthResult {
        data class Success(val e: Entitlement, val devices: List<BoundDevice> = emptyList()) : AuthResult()
        data class Failure(
            val userMessage: String,
            val errCode: String? = null,
            val devices: List<BoundDevice> = emptyList(),
        ) : AuthResult()
        // errCode=服务端结构化错误码（如 not_bound/device_bound_other/expired），
        // 巡检按它分派处置；null=无服务端应答（网络失败等），一律走离线宽限。
        // 展示文案与协议判定解耦（审查 I2：文案即协议曾使停权分派依赖中文子串）
    }

    /** 重装稳定设备标识盐（2026-09）：Android ID 盐化哈希，后端只见哈希值。
     *  盐值由宿主经 ActivationSdk.init 注入（换盐=全部存量设备指纹失效，不可变）。 */
    private val SALT_DEVICE_ID: String get() = ActivationSdk.deviceSalt

    fun deviceId(context: Context): String {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        var id = p.getString(K_DEVICE_ID, "").orEmpty()
        if (id.isEmpty()) {
            id = stableDeviceId(context)
            if (id.isEmpty()) id = UUID.randomUUID().toString()
            p.edit().putString(K_DEVICE_ID, id).apply()
        }
        return id
    }

    /**
     * 重装稳定设备标识（2026-09 拍板）：Settings.Secure.ANDROID_ID 的 SHA-256+盐哈希。
     * 同设备、同签名重装/升级不变（出厂恢复或换签名才变），供重装后按设备自动恢复激活；
     * 后端仅见哈希值，不暴露原始硬件标识。个别设备 ANDROID_ID 取不到 → 返回空串，
     * 调用方回退随机 UUID（该设备无法自动找回）。
     */
    private fun stableDeviceId(context: Context): String {
        val androidId = runCatching {
            android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ANDROID_ID
            )
        }.getOrNull().orEmpty()
        if (androidId.isBlank()) return ""
        return sha256Hex(androidId + SALT_DEVICE_ID)
    }

    /**
     * MediaDRM 设备唯一 ID 盐化哈希（2026-10-13 首启免费试用双锚第二锚）：
     * Widevine plugin 的 PROPERTY_DEVICE_UNIQUE_ID。卸载重装稳定、多数设备恢复
     * 出厂不变、root 难改（多来源一致；官方 API 不承诺持久性，GrapheneOS 等隐私
     * 系统会派生改写）。读取失败/设备不支持 → 返回空串，服务端自动回落 device_id
     * 单锚（claim 与激活链路均空值容错，不阻塞主流程）。
     * 隐私：与 stableDeviceId 同款 SHA-256+盐，后端只见哈希不暴露原始标识。
     */
    fun drmDeviceId(context: Context): String = runCatching {
        // Widevine UUID（业界通行常量 EDEF8BA9-79D6-4ACE-A3C8-27DCD51D21ED）
        val drm = android.media.MediaDrm(java.util.UUID.fromString("edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"))
        val id = try {
            drm.getPropertyByteArray(android.media.MediaDrm.PROPERTY_DEVICE_UNIQUE_ID)
        } finally {
            runCatching { drm.release() }
        }
        if (id == null || id.isEmpty()) ""
        // and 0xFF 防 %x 对 Byte 符号扩展输出 8 字符（审查 S1：保持通行 hex 惯例，
        // 防未来第二实现按直觉重算不一致）
        else sha256Hex(id.joinToString("") { "%02x".format(it.toInt() and 0xFF) } + SALT_DEVICE_ID)
    }.getOrDefault("")

    /** 主 key（最近激活）：CZ- 充值码默认目标；兼容旧调用 */
    fun storedKey(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(K_PRIMARY, "").orEmpty()

    /** app → 当前归属的激活 key（多码模型；该 app 无专属码时回退主 key）。规则包拉取鉴权用 */
    fun keyForApp(context: Context, app: String): String {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return appKeys(p)[app] ?: storedKey(context)
    }

    /** app → 归属 key 映射（多码模型核心；含旧单码迁移） */
    private fun appKeys(p: android.content.SharedPreferences): Map<String, String> {
        p.getString(K_APP_KEYS, null)?.let {
            runCatching {
                val o = JSONObject(it)
                return o.keys().asSequence().associateWith { k -> o.getString(k) }
            }
        }
        // 旧单码迁移：receipt 的 apps 全部归属该 key
        val legacy = p.getString(K_LICENSE_KEY, null) ?: return emptyMap()
        val rcpt = p.getString(K_RECEIPT, null) ?: return emptyMap()
        val apps = runCatching {
            val o = JSONObject(rcpt)
            if (o.has("exps")) o.getJSONObject("exps").keys().asSequence().toList()
            else o.optString("apps", "").split(",").filter { it.isNotEmpty() }
        }.getOrDefault(emptyList())
        return apps.associateWith { legacy }
    }

    /** key → receipt JSON 映射（多码；含旧单码迁移） */
    private fun receiptsMap(p: android.content.SharedPreferences): Map<String, String> {
        p.getString(K_RECEIPTS, null)?.let {
            runCatching {
                val o = JSONObject(it)
                return o.keys().asSequence().associateWith { k -> o.getString(k) }
            }
        }
        val legacyKey = p.getString(K_LICENSE_KEY, null) ?: return emptyMap()
        val legacyRcpt = p.getString(K_RECEIPT, null) ?: return emptyMap()
        return mapOf(legacyKey to legacyRcpt)
    }

    private fun bindingMarks(p: android.content.SharedPreferences): MutableMap<String, String> =
        runCatching {
            val o = JSONObject(p.getString(K_KEY_BINDING, "{}"))
            val m = mutableMapOf<String, String>()
            o.keys().asSequence().forEach { k -> m[k] = o.getString(k) }
            m
        }.getOrDefault(mutableMapOf())

    /** 该码当前绑定态标记：null=本机正常在绑（KeyInfoSheet 三态卡片用） */
    fun bindingState(context: Context, key: String): String? =
        bindingMarks(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE))[key]

    /** 是否存在任一处于停权态的码（unbound/bound_other）——首页停权提示条判定
     *  （审查 PM-I1：单码用户被解绑后首页不得伪装成「从未购买」） */
    fun hasSuspensionMark(context: Context): Boolean =
        bindingMarks(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)).isNotEmpty()

    private fun setBindingMark(p: android.content.SharedPreferences, key: String, state: String?) {
        // 全量读改写 JSON dict 非原子（审查 O-S3）：锁住复合段防巡检/激活并发丢更新；
        // 丢更新危害本身有界（服务端权威+巡检重写），此处防御性加固即可
        synchronized(markLock) {
            val m = bindingMarks(p)
            if (state == null) {
                if (m.remove(key) == null) return
            } else {
                m[key] = state
            }
            p.edit().putString(K_KEY_BINDING, JSONObject(m).toString()).apply()
        }
    }

    fun privacyConsented(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(K_PRIVACY_CONSENTED, false)

    fun markPrivacyConsented(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(K_PRIVACY_CONSENTED, true).apply()
    }

    /** 当前权益态（读本地 receipt；时钟防护 + 完整性校验；2s 进程内缓存见字段注释） */
    fun current(context: Context): State {
        val nowMs = System.currentTimeMillis()
        cachedState?.let { if (nowMs - cachedStateAt < STATE_CACHE_TTL_MS) return it }
        val st = computeCurrent(context)
        cachedState = st
        cachedStateAt = System.currentTimeMillis()
        return st
    }

    private fun computeCurrent(context: Context): State {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!verifyStateMac(p)) {
            Log.w(TAG, "state mac mismatch (tampered?), fail-safe to Unactivated")
            clear(context)
            return State.Unactivated
        }
        val keys = appKeys(p)
        val rcpts = receiptsMap(p)
        if (rcpts.isEmpty()) return State.Unactivated
        // 多码聚合：每 key 解析 receipt，expiries 按 app 归属 key 取值（同 app 冲突
        // 以归属映射为准）；任一 app 有效 → Active。绑定态标记非空的码不并入
        // （unbound/bound_other 按码停权，S2 口径：融合 auto-release 的旧码不受全局牵连）
        val marks = bindingMarks(p)
        val merged = HashMap<String, Long>()
        // 聚合元数据（keyId/tier/kind/deviceLimit）锚定「首个未停权且解析成功的码」（既有
        // 口径，块4 审查 S1 声明）：该码可能不贡献任何有效 app；多码并存时取值随 SP JSON
        // 键序。已知边界：试用码+正价码并存场景 kind 可能来自旧试用码（consumeTrialWelcome
        // 仅 pending 残留触达，影响面窄）；混合码成真实主路径时应改按 paid>trial 优先级聚合。
        var keyId = ""
        var tier = ""
        var kind = ""
        var deviceLimit = 1
        for ((key, rcpt) in rcpts) {
            if (marks[key] != null) continue
            val ent = parseReceipt(rcpt) ?: continue
            if (keyId.isEmpty()) { keyId = ent.keyId; tier = ent.tier; kind = ent.kind; deviceLimit = ent.deviceLimit }
            for ((app, exp) in ent.expiries) {
                // 归属映射里该 app 属于本 key 才计入（防另一张过期码的同 app 覆盖）
                if (keys[app] == null || keys[app] == key) merged[app] = exp
            }
        }
        if (merged.isEmpty()) return State.Unactivated
        touchLastSeen(p)
        val effNow = effectiveNowSeconds(p)
        val ent = Entitlement(keyId = keyId, expiries = merged, tier = tier, deviceLimit = deviceLimit, kind = kind)
        val anyValid = merged.values.any { it == 0L || it > effNow }
        return if (anyValid) State.Active(ent) else State.Expired(ent)
    }

    fun isEntitled(context: Context, app: String): Boolean {
        val st = current(context)
        if (st !is State.Active) return false
        val exp = st.e.expiries[app] ?: return false
        if (exp == 0L) return true
        return exp > effectiveNowSeconds(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE))
    }

    /** 是否存在任一 app 即将到期（≤3 天，含已到期的单独走 per-app 状态行）；永久不计数 */
    fun expiringSoon(context: Context): Boolean {
        val st = current(context)
        if (st !is State.Active) return false
        val now = effectiveNowSeconds(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE))
        return st.e.expiries.values.any { it != 0L && it > now && it - now <= 3 * 86400 }
    }

    /** 某 app 的到期时间（unix 秒，0=永久）；无该 app 权益返回 null */
    fun expiryOf(context: Context, app: String): Long? {
        val st = current(context)
        if (st !is State.Active) return null
        return st.e.expiries[app]
    }

    /**
     * 激活（key）或续费（充值码自动识别：CZ- 前缀走 /redeem，其余走 /activate）。
     * 成功后 receipt 落盘并带 MAC。
     */
    suspend fun activateOrRedeem(context: Context, input: String, merge: Boolean = false): AuthResult = withContext(Dispatchers.IO) {
        val code = input.trim().uppercase().replace(" ", "")
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val (path, body) = if (code.startsWith("CZ-")) {
            val key = storedKey(context)
            if (key.isEmpty()) return@withContext AuthResult.Failure("充值码用于续费：请先输入激活码（JP- 开头）开通")
            "/redeem" to JSONObject(mapOf("code" to code, "key" to key, "device_id" to deviceId(context)))
        } else {
            // 已使用提示（2026-08-22 拍板）：本机已激活过该码 → 直接提示，不发请求。
            // 跨设备已使用由服务端 device_limit(409) 兜住；本机查重只拦同机重复提交。
            // 例外（三态模型 2026-08-27）：该码带解绑/他机标记时放行——「绑定本机」
            // 按钮与手输重新激活的载体；成功与否由服务端上限与绑定纪律裁决。
            // 例外 2（2026-10-14 三席收敛）：merge=true 放行——确认弹窗已告知融合，
            // 同码重输并入其他在绑码的入口；服务端重激活融合幂等裁决
            if (receiptsMap(p).containsKey(code) && bindingMarks(p)[code] == null && !merge) {
                return@withContext AuthResult.Failure("该激活码已使用过")
            }
            // 多码模型：JP- 新码激活=并存新 key（响应 apps 归属改新 key，不顶替老码）；
            // intent="bind"=用户主动路径，服务端允许过上限后认领已解绑的历史行。
            // merge=true 仅手动输码确认弹窗之后（doActivateImpl 透传）：服务端重激活
            // 时吸收本机在绑其他码（「剩余时长并入」承诺落地）；claim 命中返原码等
            // 自动路径不带——重装恢复零副作用，防在绑高权益被自动烧进命中码
            val reqBody = JSONObject(
                mapOf(
                    "key" to code, "device_id" to deviceId(context),
                    "drm_id" to drmDeviceId(context),
                    "device_name" to android.os.Build.MODEL, "intent" to BINDING_INTENT_BIND
                )
            )
            if (merge) reqBody.put("merge", true)
            "/activate" to reqBody
        }
        return@withContext when (val r = postAuth(context, path, body)) {
            is AuthResult.Success -> {
                persist(context, code.takeIf { !code.startsWith("CZ-") } ?: storedKey(context), r)
                if (!code.startsWith("CZ-")) {
                    // 2026-08-24 用户拍板（方案C 根治）：新码激活成功后清理被顶替的孤儿码
                    // （全部 App 权益都已被新码接管的旧码，避免 KeyInfoSheet 展示失效旧码、
                    // 用户误点解绑报 not_bound）
                    pruneOrphanedKeys(context)
                    // 手动激活成功=服务端已建立本机绑定 → 解除该码停权标记
                    // （CZ- 纯续期不动 devices，标记必须保留，防「刚续费忽开忽关」审查 I1）
                    setBindingMark(p, code, null)
                }
                r
            }
            else -> r
        }
    }

    /**
     * 清理被顶替的孤儿码（2026-08-24 用户拍板）：appKeys 当前归属映射里不再出现的
     * 旧 key（其 App 权益已全部被新码接管）→ clearKey 清除本地 receipt。
     * 无孤儿时 no-op；clearKey 内部处理 primary 迁移与 MAC 重写。
     */
    private fun pruneOrphanedKeys(context: Context) {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val owned = appKeys(p).values.toSet()
        val orphans = receiptsMap(p).keys.filter { it !in owned }
        for (key in orphans) clearKey(context, key)
    }

    /**
     * 启动时静默刷新（2026-08-27 三态模型拍板）：巡检改打只读 /api/binding-check，
     * 绑定关系只能由主动激活（intent="bind"，activateOrRedeem 路径）变更——服务端
     * 对已解绑行的静默重放一律拒绝（ErrReleased），管理台/用户侧解绑不可被撤销。
     * 本机绑定中=刷新 receipt 并解除停权标记；解绑/被他机绑定=落标记并按码停权
     * （保留本地记录，「绑定本机」按钮有入口载体）；过期不清码沿用；吊销/无效清除；
     * 分派按结构化 errCode（审查 I2：展示文案不再承担协议职责）；errCode 缺失=
     * 无服务端应答，离线宽限保留。
     * 巡检节流（方案A'）：3 分钟最小间隔压平 onResume 级调用，显式通道不受限。
     */
    suspend fun refreshOnStart(context: Context) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (now - lastBindingCheckAt < BINDING_CHECK_MIN_INTERVAL_MS) return@withContext
        lastBindingCheckAt = now
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        for (key in receiptsMap(p).keys) checkKeyOnce(context, p, key)
    }

    /**
     * 详情页打开即查（显式通道，不走巡检节流）：单码即时 binding-check，
     * 返回最新绑定态 + 在绑设备列表（设备管理面板数据源）。
     */
    suspend fun bindingCheckNow(context: Context, key: String): BindingInfo =
        withContext(Dispatchers.IO) {
            checkKeyOnce(context, context.getSharedPreferences(PREFS, Context.MODE_PRIVATE), key)
        }

    /** 单码只读校验：刷新 receipt 与绑定标记；返回绑定态快照。分派口径见 refreshOnStart。 */
    private suspend fun checkKeyOnce(
        context: Context,
        p: android.content.SharedPreferences,
        key: String,
    ): BindingInfo {
        val body = JSONObject(mapOf("key" to key, "device_id" to deviceId(context)))
        val r = postAuth(context, "/api/binding-check", body)
        when (r) {
            is AuthResult.Success -> {
                persist(context, key, r)
                setBindingMark(p, key, null)
            }
            is AuthResult.Failure -> {
                Log.i(TAG, "binding check $key -> ${r.errCode ?: "no-answer"}: ${r.userMessage}")
                when (r.errCode) {
                    "expired" ->
                        invalidateStateCache()
                    "device_bound_other" -> {
                        setBindingMark(p, key, BINDING_MARK_OTHER)
                        invalidateStateCache()
                    }
                    "not_bound" -> {
                        setBindingMark(p, key, BINDING_MARK_UNBOUND)
                        invalidateStateCache()
                    }
                    // 人工收权/数据异常：凭证不可恢复，清本地（与三态停权不同——码号一并消失）
                    "revoked", "invalid_key" -> clearKey(context, key)
                    else -> Unit // rate_limited/internal/网络失败等：离线宽限保留
                }
            }
        }
        val devices = when (r) {
            is AuthResult.Success -> r.devices
            is AuthResult.Failure -> r.devices
        }
        return BindingInfo(bindingMarks(p)[key], devices)
    }

    /**
     * 重装自动恢复（2026-09 拍板）：本机无有效权益时按 device_id 从后端找回「仍生效、绑定
     * 本机」的激活码，并静默重建本地 receipt（与正常激活同构，含 MAC + 权益缓存失效）。
     * 已有有效权益 / 无绑定 / 网络失败均静默返回 false，不打扰用户。
     */
    suspend fun restoreFromDevice(context: Context): Boolean = withContext(Dispatchers.IO) {
        if (current(context) is State.Active) return@withContext false
        runCatching {
            val did = deviceId(context)
            val conn = URL(ActivationSdk.apiBase.trimEnd('/') + "/api/restore?device_id=" +
                java.net.URLEncoder.encode(did, "UTF-8")).openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.requestMethod = "GET"
            conn.setRequestProperty("X-Client-Version", ActivationSdk.xClientVersion)
            conn.setRequestProperty("X-Product", ActivationSdk.productId)   // X-Product 通道（批次2，v1.2）
            val code = conn.responseCode
            val respBody = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            if (code != 200) return@runCatching false
            val arr = JSONObject(respBody).optJSONArray("keys") ?: return@runCatching false
            var restored = false
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val keyId = o.optString("key_id", "").ifBlank { continue }
                val exps = o.optJSONObject("expiries") ?: continue
                val expiries = exps.keys().asSequence().associateWith { exps.getLong(it) }
                if (expiries.isEmpty()) continue
                val ent = Entitlement(
                    keyId = keyId,
                    expiries = expiries,
                    tier = o.optString("tier", ""),
                    deviceLimit = o.optInt("device_limit", 1),
                    // restore keys 项同构下发（组1 块3：restore 链是试用重装主路径，
                    // 漏发则欢迎通知静默丢失——平台已复用 activationResp 单点覆盖）
                    kind = o.optString("entitlement_kind", ""),
                )
                persist(context, keyId, AuthResult.Success(ent))
                restored = true
            }
            // 权益变化事件（2026-10-14 拍板）：restore 找回成功即通知宿主（常驻席弹
            // 「已恢复本机激活」toast、生命周期席刷状态行）——restore 改由 claim 409
            // 分支接管后的唯一触发点
            if (restored) {
                // 正价重装零弹窗（2026-10-14 拍板）：找回即撤销试用资格待弹标志——
                // 恢复出权益的设备不是「首启试用」受众；不置 welcomed（资格语义上
                // 从未弹过），后续 hasReceipts 锚同样防重置
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(K_TRIAL_PENDING, false).apply()
                notifyEntitlementChanged(EntitlementChange.RESTORED)
            }
            restored
        }.getOrElse {
            Log.w(TAG, "restoreFromDevice failed: ${it.message}")
            false
        }
    }

    /** 权益变化订阅（2026-10-14 时序重梳拍板）：claim 成功 / restore 找回即回调，
     *  宿主刷新状态行（事件驱动替代 30s tick 轮询消费）。列表注册而非单槽——
     *  Application 常驻席（restore toast）与首页生命周期席（刷 UI）并存；生命周期席
     *  onStart 注册 / onStop 注销防泄漏，错过回调由 onResume 全量刷兜底。
     *  回调在 SDK IO 线程触发，实现方自行切主线程。 */
    enum class EntitlementChange { CLAIMED, RESTORED }

    private val entitlementListeners =
        java.util.concurrent.CopyOnWriteArrayList<(EntitlementChange) -> Unit>()

    fun registerEntitlementListener(l: (EntitlementChange) -> Unit) {
        entitlementListeners.add(l)
    }

    fun unregisterEntitlementListener(l: (EntitlementChange) -> Unit) {
        entitlementListeners.remove(l)
    }

    // internal（模块内）：单测直接断言触发语义（组1 块4）；对宿主不可见
    internal fun notifyEntitlementChanged(change: EntitlementChange) {
        Log.i(TAG, "entitlementChanged: $change listeners=${entitlementListeners.size}")
        invalidateStateCache()
        for (l in entitlementListeners) runCatching { l(change) }
    }

    // 监听器快照（组1 块4 测试面）：纯 JVM 断言注册/注销语义
    internal fun listenerCountForTest(): Int = entitlementListeners.size

    /**
     * 首启资格待弹前置判定（2026-10-14 拍板，审查 I-1 修订）：Application onCreate
     * 主线程同步调用，必须先于任何 claim 网络请求——「receipts 空」锚会被 claim 落库
     * 污染（网络 1~2s 即 persist，慢机型首帧晚于此 → 漏弹竞态），判定收拢在发起前零竞态。
     * DONE（购买墙=曾试用过期）不置——资格语义对这类设备是虚假承诺（拍板：接受静默）。
     */
    fun markTrialWelcomePendingIfEligible(context: Context) {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val welcomed = p.getBoolean(K_TRIAL_WELCOMED, false)
        val pending = p.getBoolean(K_TRIAL_PENDING, false)
        val done = p.getBoolean(K_TRIAL_DONE, false)
        val hasReceipts = receiptsMap(p).isNotEmpty()
        Log.i(TAG, "welcomePending check: welcomed=$welcomed pending=$pending done=$done hasReceipts=$hasReceipts")
        if (welcomed || pending || done || hasReceipts) return
        p.edit().putBoolean(K_TRIAL_PENDING, true).apply()
        Log.i(TAG, "welcomePending -> SET")
    }

    /**
     * 消费资格待弹标志（2026-10-14 晚拍板，结果驱动弹/用户 grilling 定稿）：资格卡语义
     * 从「首启告知」改为「试用发放成功通知」——仅当试用真实生效（Active 且 tier=试用）
     * 才消费+弹。正价 Active（restore 恢复，RESTORED 已清 pending）、购买墙（done）、
     * 未激活（claim 在途/弱网失败）一律保留 pending 不弹：正价零误弹、文案永真、弱网
     * 待弹标志保留待下次冷启动 claim 成功后补弹。调用时机两入口：首页 onResume（补判）
     * + CLAIMED 回调（快网 claim 早于首帧，宿主 listener 触发）。展示即清（弹一次）。
     */
    fun consumeTrialWelcome(context: Context): Boolean {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pending = p.getBoolean(K_TRIAL_PENDING, false)
        Log.i(TAG, "welcomeConsume: pending=$pending")
        if (!pending) return false
        val st = current(context)
        // kind 语义化判定（组1 块4）：服务端 entitlement_kind 优先，缺失回落 tier 比对过渡
        val show = st is State.Active && st.e.isTrial()
        Log.i(TAG, "welcomeConsume: state=${st.javaClass.simpleName} -> show=$show")
        if (show) {
            p.edit().putBoolean(K_TRIAL_PENDING, false).putBoolean(K_TRIAL_WELCOMED, true).apply()
        }
        return show
    }

    /** 全部激活码条目（多码）：key → 各自 Entitlement（KeyInfoSheet 展示用） */
    fun keyEntries(context: Context): List<Pair<String, Entitlement>> {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return receiptsMap(p).mapNotNull { (key, rcpt) ->
            parseReceipt(rcpt)?.let { key to it }
        }
    }

    /**
     * 首启免费试用 claim（2026-10-13 拍板，方案 docs/首启免费试用3天实施方案-v1.md）：
     * 调用契约=restoreFromDevice 先行且未恢复出权益、本地 State==Unactivated
     * （Expired 不 claim 直面购买墙；正价重装由 restore 接管不会走到这里）。
     * 服务端幂等：双锚（device_id/drm_id）命中返原码——拿到码走 activateOrRedeem
     * 复用现有激活全链（验签/绑定），App 不加试用状态机。
     * 失败静默重试（指数退避；请求前先记时间防 429 风暴）；命中原码且已过期
     * （激活返回 expired）→ 标记 DONE 不再空转。返回 true=试用已就绪（Active）。
     */
    suspend fun claimTrial(context: Context): Boolean = withContext(Dispatchers.IO) {
        if (!tryBeginClaim()) return@withContext false
        try {
            claimTrialImpl(context)
        } finally {
            endClaim()
        }
    }

    // 退避判定 seam（组1 块4 测试面）：纯函数化，claimTrialImpl 编排消费——
    // 序列=现状锁定（2026-10-13/14 拍板，非指数退避+jitter 惯例，调整须先对标）。
    internal fun trialBackoffMs(fails: Int): Long =
        TRIAL_BACKOFF_MS[fails.coerceAtMost(TRIAL_BACKOFF_MS.size - 1)]

    internal fun shouldAttemptTrialAt(fails: Int, lastAt: Long, nowMs: Long): Boolean =
        lastAt <= 0L || nowMs - lastAt >= trialBackoffMs(fails)

    // 409 分派 seam：仅 trial_has_license 语义导航 restore（审查 S9：防未来 409
    // 增义被误判「本机已有权益」白跑 restore）
    internal fun trial409WantsRestore(body: String): Boolean =
        runCatching { JSONObject(body).optString("error") }.getOrDefault("") == "trial_has_license"

    private suspend fun claimTrialImpl(context: Context): Boolean = withContext(Dispatchers.IO) {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (p.getBoolean(K_TRIAL_DONE, false)) return@withContext false
        if (current(context) !is State.Unactivated) return@withContext false
        val fails = p.getInt(K_TRIAL_FAILS, 0)
        val last = p.getLong(K_TRIAL_LAST, 0L)
        val nowMs = System.currentTimeMillis()
        if (!shouldAttemptTrialAt(fails, last, nowMs)) {
            return@withContext false
        }
        p.edit().putLong(K_TRIAL_LAST, nowMs).apply()
        // 请求即收状态码与响应体。2026-10-14 claim 先行编排：409 trial_has_license=
        // 设备有仍生效绑定（正价重装）→ restore 接管；其余非 200（限流/关断/发放量
        // 熔断/版本门槛）静默退避重试。disconnect 入 try/finally（审查 S4：异常路径
        // 不泄漏连接）
        val resp: Pair<Int, String>? = runCatching {
            val body = JSONObject(
                mapOf(
                    "device_id" to deviceId(context),
                    "drm_id" to drmDeviceId(context),
                    "device_name" to android.os.Build.MODEL,
                )
            )
            val conn = URL(ActivationSdk.apiBase.trimEnd('/') + "/api/trial-claim").openConnection() as HttpURLConnection
            val code: Int
            val respBody: String
            try {
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.doOutput = true
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.setRequestProperty("X-Client-Version", ActivationSdk.xClientVersion)
                conn.setRequestProperty("X-Product", ActivationSdk.productId)
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                code = conn.responseCode
                respBody = (if (code in 200..299) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
            } finally {
                conn.disconnect()
            }
            code to respBody
        }.getOrElse {
            Log.w(TAG, "claimTrial failed: ${it.message}")
            null
        }
        if (resp == null) {
            p.edit().putInt(K_TRIAL_FAILS, fails + 1).apply()
            return@withContext false
        }
        val (code, respBody) = resp
        if (code == 409) {
            // 正价重装导航（审查 I-6）：restore 找回；失败不计 fails——付费用户权益
            // 恢复不被试用退避拉长（restore 保持每次冷启动重试，同旧行为）。
            if (trial409WantsRestore(respBody)) return@withContext restoreFromDevice(context)
            Log.i(TAG, "trial claim 409 unexpected")
            p.edit().putInt(K_TRIAL_FAILS, fails + 1).apply()
            return@withContext false
        }
        if (code != 200) {
            Log.i(TAG, "trial claim -> $code: ${respBody.take(200)}")
            p.edit().putInt(K_TRIAL_FAILS, fails + 1).apply()
            return@withContext false
        }
        val root = runCatching { JSONObject(respBody) }.getOrNull()
        // claim 即激活（2026-10-14 拍板①）：新发路径响应同构 activationResp 带 receipt，
        // 验签落库直达 Active（复用 postAuth 验签解析管道）；hit（重装/重复 claim，原码
        // 时效未知）与老服务端无 receipt 字段 → 回退 /activate 两跳（expired 信号走购买墙）
        if (root?.has("receipt") == true) {
            return@withContext when (val r = parseActivationResp(root)) {
                is AuthResult.Success -> {
                    persist(context, r.e.keyId, r)
                    p.edit().putInt(K_TRIAL_FAILS, 0).putLong(K_TRIAL_LAST, 0L).putBoolean(K_TRIAL_DONE, false).apply()
                    notifyEntitlementChanged(EntitlementChange.CLAIMED)
                    true
                }
                is AuthResult.Failure -> {
                    // 验签失败等异常响应：计一次失败退避重试（下次请求拿全新签名）
                    p.edit().putInt(K_TRIAL_FAILS, fails + 1).apply()
                    false
                }
            }
        }
        val ok = root?.optString("key_id", "")?.takeIf { it.isNotBlank() }
        if (ok == null) {
            p.edit().putInt(K_TRIAL_FAILS, fails + 1).apply()
            return@withContext false
        }
        // 本机已持有该码 receipt（claim 幂等返原码的本地分支）：跳过 activate 直接看
        // 本地态；非 Active（receipt 半损坏边缘）计一次失败让退避升级，防分钟级空转
        // 只靠服务端限流收敛（审查 S2）
        if (receiptsMap(p).containsKey(ok)) {
            invalidateStateCache()
            val active = current(context) is State.Active
            if (!active) p.edit().putInt(K_TRIAL_FAILS, fails + 1).apply()
            return@withContext active
        }
        return@withContext when (val r = activateOrRedeem(context, ok)) {
            is AuthResult.Success -> {
                p.edit().putInt(K_TRIAL_FAILS, 0).putLong(K_TRIAL_LAST, 0L).putBoolean(K_TRIAL_DONE, false).apply()
                notifyEntitlementChanged(EntitlementChange.CLAIMED)
                true
            }
            is AuthResult.Failure -> {
                if (r.errCode == "expired") {
                    // 命中原码已过期：购买墙态，服务端每次都会返同一张码，不再空转。
                    // 顺手清待弹标志（2026-10-14 结果驱动弹：done=永不可能再有「试用
                    // 已生效」，pending 滞留无意义，防脏态）
                    p.edit().putBoolean(K_TRIAL_DONE, true).remove(K_TRIAL_PENDING).apply()
                } else {
                    p.edit().putInt(K_TRIAL_FAILS, fails + 1).apply()
                }
                false
            }
        }
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(K_RECEIPT).remove(K_LICENSE_KEY).remove(K_APP_KEYS).remove(K_RECEIPTS)
            .remove(K_KEY_BINDING)
            .remove(K_PRIMARY).remove(K_LAST_SEEN).remove(K_MAC)
            .remove(K_TRIAL_FAILS).remove(K_TRIAL_LAST).remove(K_TRIAL_DONE)
            .remove(K_TRIAL_PENDING).remove(K_TRIAL_WELCOMED)
            // "trial_just_started"：K_TRIAL_JUST_STARTED 已退役（2026-10-14 时序重梳），
            // 升级用户 SP 残留清理
            .remove("trial_just_started").apply()
        invalidateStateCache()
    }

    /** 清除单个 key（多码模型：该 key receipt + 其归属 app 条目） */
    fun clearKey(context: Context, key: String) {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val rcpts = receiptsMap(p).toMutableMap()
        if (rcpts.remove(key) == null) return
        setBindingMark(p, key, null)
        val keys = appKeys(p).filterValues { it != key }
        // macLock：同 persist（竞态修复 2026-10-14）
        synchronized(macLock) {
            p.edit()
                .putString(K_RECEIPTS, JSONObject(rcpts).toString())
                .putString(K_APP_KEYS, JSONObject(keys).toString())
                .apply()
            if (storedKey(context) == key) {
                p.edit().putString(K_PRIMARY, rcpts.keys.firstOrNull() ?: "").apply()
            }
            writeStateMac(p)
        }
        invalidateStateCache()
    }

    /** 解绑指定 key 的本机设备（多码模型：KeyInfoSheet 指定码解绑）；成功后清除该
     *  key 本地权益。每月限 1 次由服务端控制。体验卡（trial7/trial3）除外：服务端
     *  禁止自助解绑（一码一用锁首绑设备，2026-10-24），仅管理台客诉通道可解。
     *  key 本地权益，激活码可在新设备重新激活（用户侧每月限 1 次，服务端控制） */
    suspend fun releaseDevice(context: Context, keyOverride: String? = null): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val key = keyOverride ?: storedKey(context)
            check(key.isNotEmpty()) { "本机未开通会员，无需解绑" }
            val body = JSONObject(mapOf("key" to key, "device_id" to deviceId(context)))
            val conn = URL(ActivationSdk.apiBase.trimEnd('/') + "/device/release").openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.doOutput = true
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.setRequestProperty("X-Client-Version", ActivationSdk.xClientVersion)
            conn.setRequestProperty("X-Product", ActivationSdk.productId)   // X-Product 通道（批次2，v1.2）
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val respBody = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            if (code != 200) {
                val err = runCatching { JSONObject(respBody).optString("error") }.getOrDefault("")
                error(
                    when (err) {
                        "not_bound" -> "该激活码未绑定本机（可能是已被新激活码顶替，或在其他设备解绑），无需重复解绑"
                        "trial_no_release" -> "体验卡为一次性试用权益，不支持解绑或转移设备，如需更换设备请联系客服协助"
                        "release_limit" -> "本月解绑次数已用完（每月限 1 次），请联系客服协助"
                        else -> "服务异常（$code），请稍后再试"
                    }
                )
            }
            clearKey(context, key)
        }
    }

    /**
     * 远程解绑他机占用（2026-08-27 设备管理面板）：/device/release 本无「仅本机」
     * 约束——key 即凭证的自助换绑模型，服务端同一月限口径管控。与 releaseDevice
     * 同请求骨架，但目标非本机，不清本地任何权益状态。成功返回 null，失败返回用户文案。
     */
    suspend fun releaseRemote(context: Context, key: String, targetDeviceId: String): String? =
        withContext(Dispatchers.IO) {
            runCatching {
                val body = JSONObject(mapOf("key" to key, "device_id" to targetDeviceId))
                val conn = URL(ActivationSdk.apiBase.trimEnd('/') + "/device/release").openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.doOutput = true
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.setRequestProperty("X-Client-Version", ActivationSdk.xClientVersion)
                conn.setRequestProperty("X-Product", ActivationSdk.productId)   // X-Product 通道（批次2，v1.2）
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                val respBody = (if (code in 200..299) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()
                if (code != 200) {
                    val err = runCatching { JSONObject(respBody).optString("error") }.getOrDefault("")
                    error(
                        when (err) {
                            "not_bound" -> "该设备已不在此码名下，刷新后查看最新列表"
                            "trial_no_release" -> "体验卡为一次性试用权益，不支持解绑或转移设备，如需更换设备请联系客服协助"
                            "release_limit" -> "本月解绑次数已用完（每月限 1 次），请联系客服协助"
                            else -> "服务异常（$code），请稍后再试"
                        }
                    )
                }
                null
            }.getOrElse { e ->
                Log.w(TAG, "release remote failed: ${e.message}")
                e.message ?: "网络异常，请稍后再试"
            }
        }

    /**
     * 到期处置（M3；决策 #6 per-app 化；SDK 化改造）：逐个受管 app 检查——权益
     * 缺失/过期则回调宿主处置钩子（净屏=停其 uid 的过滤，意图关闭规则保留，续费后
     * 重开即恢复）。不再全局一刀切（per-app 到期互不牵连）。钩子未注册=不做任何
     * 处置（宿主只消费 State 自行判定亦合法）。
     */
    suspend fun enforceExpiry(context: Context) {
        val hook = ActivationSdk.onAppNotEntitled ?: return
        for (m in ActivationSdk.managedAppsProvider()) {
            val uid = runCatching {
                context.packageManager.getPackageUid(m.targetPackage, 0)
            }.getOrNull() ?: continue
            if (isEntitled(context, m.app)) continue
            hook(context, m)
            Log.w(TAG, "entitlement expired for ${m.app} (uid=$uid), host notified")
        }
    }

    /**
     * App 活跃上报（看板「累计安装设备/安装设备明细」，2026-09-21 三角色审查拍板）：
     * 每次回前台 fire-and-forget 上报 device_id 的盐化单次哈希，后端 /app/install
     * upsert 刷 last_seen（管理台「最近活跃」=打开/回前台即刷；未激活设备的活跃
     * 时间不再静止在首启）。上报 device_id = stableDeviceId(context)（重装稳定的
     * 设备 hash：Android ID 盐化哈希）；后端按 device_id 去重 upsert——首见行记
     * first_seen（首装/累计口径不变），已见行只刷 last_seen/app_ver，重装/升级
     * 不重复计数。原「版本变化才上报一次」（install_reported_ver 节流）已随本拍板
     * 移除（含 pref 读写），app_ver 仍跟随最新版本。与 GA4 first_open/session_start
     * 分事件不同，本项目合并单管道（first_seen 承接首装、last_seen 承接活跃），
     * 效果等价、本产品自定简化（upsert 无计数副作用）。
     * 隐私：device_id 为不可逆盐化哈希，不暴露原始设备标识。
     */
    suspend fun reportInstall(context: Context) {
        if (!ActivationSdk.installReportEnabled) return   // v1.1 上收配套开关（可配置，净屏沿用开启）
        val ver = ActivationSdk.xClientVersion
        withContext(Dispatchers.IO) {
            runCatching {
                val body = JSONObject(
                    mapOf(
                        "device_id" to stableDeviceId(context).ifEmpty { deviceId(context) },
                        "app_pkg" to context.packageName,
                        "app_ver" to ver,
                    )
                )
                val conn = URL(ActivationSdk.apiBase.trimEnd('/') + "/app/install").openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.doOutput = true
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.setRequestProperty("X-Client-Version", ver)
                conn.setRequestProperty("X-Product", ActivationSdk.productId)   // X-Product 通道（批次2，v1.2）
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                conn.disconnect()
                if (code !in 200..299) Log.w(TAG, "install report failed: $code")
            }.onFailure { Log.w(TAG, "install report error", it) }
        }
    }

    private fun sha256Hex(input: String): String {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        return md.digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }

    // ---------- 内部 ----------

    private fun postAuth(context: Context, path: String, body: JSONObject): AuthResult =
        runCatching {
            val conn = URL(ActivationSdk.apiBase.trimEnd('/') + path).openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            // doOutput 必须先开（真机实证修复：不开则 getOutputStream 直接抛 IOException，
            // 请求未发出即被 runCatching 转成「网络异常」——GET 链路无 body 故不受影响，
            // 激活/续费 POST 全挂在写 body 一步；M3 起缺失，激活链路首次真机全链路跑暴露）
            conn.doOutput = true
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.setRequestProperty("X-Client-Version", ActivationSdk.xClientVersion)
            conn.setRequestProperty("X-Product", ActivationSdk.productId)   // X-Product 通道（批次2，v1.2）
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val respBody = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            if (code != 200) {
                val jo = runCatching { JSONObject(respBody) }.getOrNull()
                val errCode = jo?.optString("error")?.takeIf { it.isNotEmpty() }
                return@runCatching AuthResult.Failure(mapError(code, respBody), errCode, parseDevices(jo))
            }
            parseActivationResp(JSONObject(respBody))
        }.getOrElse {
            // 真机实证（2026-08-22）：服务端 200 但客户端仍报网络异常且 message 为空——
            // runCatching 吞栈无日志，logcat 空白无法定位；此处落日志保留完整栈
            Log.e(TAG, "postAuth failed: $path", it)
            AuthResult.Failure("网络异常，请稍后再试（${it.message ?: ""}）")
        }

    /**
     * activationResp 同构响应解析（/activate、/api/binding-check(ok)、/api/trial-claim
     * 新发三端口共用——claim 即激活 2026-10-14，客户端单源防双份 canonical 漂移）：
     * 验签 receipt（公钥配置时）→ Entitlement。root 需含 key_id/tier[/receipt]。
     */
    private fun parseActivationResp(root: JSONObject): AuthResult = runCatching {
        val rc = root.getJSONObject("receipt")
        val pub = ActivationSdk.servicePubkeyHex
        if (pub.isNotEmpty()) {
            // 验签：v1/v2 两套 canonical（决策 #8）。v2 = kid|did|ver|apps排序|exps
            // 按 app 名排序("app:ts"逗号join)|tier|exp|iat；v1 保持老格式。
            val ver = rc.optInt("ver", 0)
            val canonical = if (ver >= 2) {
                val apps = (0 until rc.getJSONArray("apps").length())
                    .map { rc.getJSONArray("apps").getString(it) }.sorted()
                val exps = rc.getJSONObject("exps")
                val expsCanonical = exps.keys().asSequence().sorted()
                    .joinToString(",") { k -> "$k:${exps.getLong(k)}" }
                listOf(
                    rc.getString("kid"), rc.getString("did"), ver.toString(),
                    apps.joinToString(","), expsCanonical,
                    rc.getString("tier"), rc.getLong("exp").toString(), rc.getLong("iat").toString()
                ).joinToString("|")
            } else {
                // v1 canonical（审查 I2）：JSONArray.join(",") 会给元素加双引号
                // （"fanqie","hongguo"），与服务端 strings.Join 的 fanqie,hongguo 不符，
                // 配公钥后 v1 路径验签必失败——改 map+joinToString 拼裸值。
                val appsV1 = (0 until rc.getJSONArray("apps").length())
                    .map { rc.getJSONArray("apps").getString(it) }
                listOf(
                    rc.getString("kid"), rc.getString("did"),
                    appsV1.joinToString(","),
                    rc.getString("tier"), rc.getLong("exp").toString(), rc.getLong("iat").toString()
                ).joinToString("|")
            }
            val ok = Ed25519Verify.verify(
                hexToBytes(pub), canonical.toByteArray(Charsets.UTF_8),
                Base64.decode(rc.getString("sig"), Base64.DEFAULT)
            )
            if (!ok) return@runCatching AuthResult.Failure("服务返回数据校验失败，请稍后再试")
        }
        AuthResult.Success(
            Entitlement(
                keyId = root.getString("key_id"),
                expiries = parseExpiries(root),
                tier = root.getString("tier"),
                deviceLimit = root.optInt("device_limit", 1),
                kind = root.optString("entitlement_kind", ""),
            ),
            devices = parseDevices(root)
        )
    }.getOrElse {
        Log.e(TAG, "parseActivationResp failed", it)
        AuthResult.Failure("服务返回数据校验失败，请稍后再试")
    }

    private fun mapError(code: Int, body: String): String {
        val err = runCatching { JSONObject(body).optString("error") }.getOrDefault("")
        return when (err) {
            "invalid_key" -> "激活码无效，请核对后重试"
            "revoked" -> "该激活码已被吊销，请联系售后"
            "expired" -> "该激活码已过期"
            // binding-check(404)：本机未绑定该码（已解绑或从未绑定）；文案不含
            // 「已过期/已吊销/无效」，老版本 App 静默重放命中时不会误清本地码
            "not_bound" -> "该激活码未绑定本机（可能是已被新激活码顶替，或在其他设备解绑），无需重复解绑"
            "device_bound_other" -> "该激活码已在其他手机使用，绑定后才可用（如非本人操作请联系客服）"
            "device_limit" -> "设备数已满：请在原设备解绑，或到订单页查看换绑说明"
            "trial_used" -> "体验卡每设备限用 1 张，如需继续使用请购买月卡/年卡"
            "invalid_code" -> "充值码无效或已使用"
            "key_not_found" -> "请先用激活码（JP- 开头）开通后，再用充值码续费"
            "rate_limited" -> "操作过于频繁，请稍后再试"
            "upgrade_required" -> "App 版本过旧，请到官网下载新版"
            else -> "服务异常（$code），请稍后再试"
        }
    }

    /** receipt JSON 组装 seam（组1 块4 测试面）：persist 落盘形状单源，纯 JVM
     *  可与 parseReceipt 往返断言（不丢字段/口径不漂）。 */
    internal fun buildReceiptJson(e: Entitlement, deviceId: String, iatSec: Long, nowMs: Long): String {
        val exps = JSONObject()
        e.expiries.forEach { (app, ts) -> exps.put(app, ts) }
        val receipt = JSONObject()
        receipt.put("kid", e.keyId)
        receipt.put("did", deviceId)
        receipt.put("ver", 2)
        receipt.put("apps", e.apps.sorted().joinToString(","))
        receipt.put("exps", exps)
        receipt.put("tier", e.tier)
        // kind 随 receipt 落盘（组1 块4：离线态判定不依赖网络；旧持久化无此键→
        // parseReceipt 回落空串→isTrial() 过渡比对，见 Entitlement.kind 注释）
        receipt.put("kind", e.kind)
        // 聚合 exp（v1 兼容口径：min 非零，全 0 则 0）；per-app 以 exps 为准
        receipt.put("exp", e.expiries.values.filter { it != 0L }.minOrNull() ?: 0L)
        receipt.put("iat", iatSec)
        receipt.put("device_limit", e.deviceLimit)
        return receipt.toString()
    }

    private fun persist(context: Context, key: String, r: AuthResult.Success) {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val e = r.e
        val receipt = buildReceiptJson(e, deviceId(context), System.currentTimeMillis() / 1000, System.currentTimeMillis())

        val rcpts = receiptsMap(p).toMutableMap()
        rcpts[key] = receipt
        val keys = appKeys(p).toMutableMap()
        e.apps.forEach { keys[it] = key } // 响应 apps 归属本 key（同 app 冲突=新码接管）

        // macLock：凭证写入（payload 成分）与 writeStateMac 原子于并发 verify（竞态修复 2026-10-14）
        synchronized(macLock) {
            p.edit()
                .putString(K_RECEIPTS, JSONObject(rcpts).toString())
                .putString(K_APP_KEYS, JSONObject(keys).toString())
                .putString(K_PRIMARY, key)
                .putLong(K_LAST_SEEN, System.currentTimeMillis())
                .apply()
            // 注意：persist 不清绑定态标记——/redeem 续期路径也复用本函数而服务端
            // RedeemCode 不触碰 devices 行，「清标记=恢复绑定」语义归调用方表达
            // （refreshOnStart ok / activateOrRedeem JP- 成功两处显式清理）
            writeStateMac(p)
        }
        invalidateStateCache()
    }

    /**
     * 解析本地 receipt：新格式（含 exps map，per-app）优先；旧格式（无 exps，
     * apps + exp 单值）本地展开为 {app: exp 各 app 同值}——离线老用户自愈
     * （决策 #6）。deviceLimit 从 device_limit 字段读（修复写死 1 的问题）。
     */
    private fun parseReceipt(json: String): Entitlement? = runCatching {
        val o = JSONObject(json)
        val expiries: Map<String, Long> = if (o.has("exps")) {
            val ex = o.getJSONObject("exps")
            ex.keys().asSequence().associateWith { ex.getLong(it) }
        } else {
            val apps = o.getString("apps").split(",").filter { it.isNotEmpty() }
            val exp = o.getLong("exp")
            apps.associateWith { exp }
        }
        Entitlement(
            keyId = o.getString("kid"),
            expiries = expiries,
            tier = o.getString("tier"),
            deviceLimit = o.optInt("device_limit", 1),
            kind = o.optString("kind", ""),
        )
    }.getOrNull()

    // internal（模块内）：⑤persist→parse 往返单测入口（组1 块4）
    internal fun parseReceiptForTest(json: String): Entitlement? = parseReceipt(json)

    /** 服务端响应 expiries 解析：v2 有 per-app map；v1 无 map 时 apps+expires_at 展开为同值 */
    private fun parseExpiries(root: JSONObject): Map<String, Long> {
        if (root.has("expiries")) {
            val o = root.getJSONObject("expiries")
            return o.keys().asSequence().associateWith { o.getLong(it) }
        }
        val apps = (0 until root.getJSONArray("apps").length())
            .map { root.getJSONArray("apps").getString(it) }
        val exp = root.getLong("expires_at")
        return apps.associateWith { exp }
    }

    /** 服务端 devices 列表解析（设备管理面板；成功响应与 device_bound_other 409 均携带，
     *  每行已带 self 标记） */
    private fun parseDevices(root: JSONObject?): List<BoundDevice> {
        val arr = root?.optJSONArray("devices") ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            BoundDevice(
                deviceId = o.optString("device_id"),
                deviceName = o.optString("device_name"),
                boundAt = o.optLong("bound_at", 0),
                isSelf = o.optBoolean("self", false),
            )
        }
    }

    /** 单调推进 last_seen（仅前进不后退）并重写 MAC；60s 节流（I9：高频 current()
     *  不再每次触发 Keystore 重算+写盘，防回拨语义不变——effectiveNow 取存的值）。
     *  macLock：payload 写入与 MAC 校验互斥（竞态修复 2026-10-14，见字段注释） */
    private fun touchLastSeen(p: android.content.SharedPreferences) {
        synchronized(macLock) {
            val now = System.currentTimeMillis()
            val last = p.getLong(K_LAST_SEEN, 0L)
            if (now <= last) return
            if (now - lastSeenWriteAt < LAST_SEEN_THROTTLE_MS && last > 0L) return
            p.edit().putLong(K_LAST_SEEN, now).apply()
            writeStateMac(p)
            lastSeenWriteAt = now
        }
    }

    /** 回拨判定：系统时间显著落后 last_seen 时，以 last_seen 为准（容忍 5 分钟） */
    private fun effectiveNowSeconds(p: android.content.SharedPreferences): Long {
        val now = System.currentTimeMillis()
        val last = p.getLong(K_LAST_SEEN, 0L)
        val eff = if (now + ROLLBACK_TOLERANCE_MS < last) last else now
        return eff / 1000
    }

    // ---------- Keystore MAC 完整性 ----------

    private fun mac(p: android.content.SharedPreferences): String? = runCatching {
        val ks = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (!ks.containsAlias(KEYSTORE_ALIAS)) {
            val kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, "AndroidKeyStore")
            kg.init(
                KeyGenParameterSpec.Builder(KEYSTORE_ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                    .setDigests(KeyProperties.DIGEST_SHA256).build()
            )
            kg.generateKey()
        }
        val mac = Mac.getInstance("HmacSHA256").apply { init(ks.getKey(KEYSTORE_ALIAS, null)) }
        // 多码 MAC payload：keys 映射 + 全部 receipt（排序拼接，确定性）+ last_seen
        val rcpts = receiptsMap(p).toSortedMap()
        val keysStr = rcpts.entries.joinToString(";") { (k, v) -> "$k=${v.hashCode()}" }
        val legacy = p.getString(K_RECEIPT, "").orEmpty()
        val payload = keysStr + "|" + legacy + "|" + p.getLong(K_LAST_SEEN, 0L)
        android.util.Base64.encodeToString(mac.doFinal(payload.toByteArray()), android.util.Base64.NO_WRAP)
    }.getOrNull()

    // MAC 完整性读写锁（2026-10-14 竞态修复）：payload 成分（receipts/last_seen）的
    // 写入与 MAC 计算/校验必须互斥——否则 verify 读 stored 与现算 fresh 的间隙里另一
    // 线程 touchLastSeen/persist 改 payload → 误判 mismatch → clear() 清掉刚落库的
    // 凭证（实测：CLAIMED 事件 27ms 内主线程并发 current() 即现形，状态行闪回「开通」
    // 后靠退避重试自愈）。Kotlin synchronized 同对象可重入，嵌套调用安全
    private val macLock = Any()

    private fun writeStateMac(p: android.content.SharedPreferences) {
        synchronized(macLock) {
            mac(p)?.let { p.edit().putString(K_MAC, it).apply() }
        }
    }

    private fun verifyStateMac(p: android.content.SharedPreferences): Boolean {
        synchronized(macLock) {
            val stored = p.getString(K_MAC, null)
            if (stored == null) {
                // 无 MAC 分两种（2026-10-14 修复）：①全新安装/pm clear——SP 无任何凭证，
                // 放行（MAC 由 persist 重建；此前一律 false → computeCurrent 误判篡改走
                // clear()，把 claim 前置的 K_TRIAL_PENDING 等启动早期标志连带清掉，资格卡
                // 静默漏弹）；②有凭证而无 MAC——手改 SP 注入 receipt 的篡改信号，维持 fail。
                val hasPayload = p.getString(K_RECEIPTS, null) != null ||
                    p.getString(K_RECEIPT, null) != null || p.getString(K_APP_KEYS, null) != null
                return !hasPayload
            }
            val fresh = mac(p) ?: return true // Keystore 不可用时降级放行（少数 ROM）
            return stored == fresh
        }
    }

    private fun hexToBytes(hex: String): ByteArray =
        hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
