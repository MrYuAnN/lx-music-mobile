/*
 * 净屏 P2 - 套餐 SKU（决策 #16/#19：公开 SKU JSON API 单一事实来源，五档全量渲染）
 * 基于 RethinkDNS (Apache-2.0) 二次开发
 *
 * 服务端契约（P0 交付，小写字段）：GET {apiBase}/api/skus → {"skus":[{id,name,apps[],
 * tier,days,device_limit,price_cents}]}。days=0 表示永久。
 *
 * 纯函数（parse/group/savings）JVM 单测可用；网络拉取成功即缓存 prefs（json），
 * 离线用缓存渲染并标注「价格以支付页为准」。
 */
package top.astock.activation

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

object PlanSkus {

    private const val PREFS = "jingping"
    private const val K_SKU_CACHE = "sku_cache_json"
    private const val K_SKU_CACHE_AT = "sku_cache_at"
    private const val TIMEOUT_MS = 15000

    /** 服务端契约 SKU（小写字段） */
    data class Sku(
        val id: String,
        val name: String,
        val apps: List<String>,
        val tier: String,
        val days: Int, // 0 = 永久
        val deviceLimit: Int,
        val priceCents: Int
    ) {
        /** 是否永久（days=0） */
        val isForever: Boolean get() = days <= 0
    }

    /** 按 App 维度分组后的套餐组（番茄小说/红果短剧/全家桶/其它） */
    data class PlanGroup(
        val key: String, // 组标识：fanqie / hongguo / all / apps.join(",")
        val title: String,
        val skus: List<Sku>
    ) {
        val isFamily: Boolean get() = key == "all"
    }

    /** app id → 中文名（客户端唯一展示名来源，与后端 appCN 对齐；Worker/UI 共用）。
     *  2026-10-15 红果漫剧并入拍板：hongguo 一份码管双 app（短剧 com.phoenix.read +
     *  漫剧 com.kylin.read），展示名改双壳表述（方案 A7，与后端 describe.go 同批对齐） */
    val APP_CN = mapOf("fanqie" to "番茄小说", "hongguo" to "红果免费短剧/漫剧")
    const val FAMILY_CN = "全家桶"

    /** 在线支付是否开通（服务端 payable 字段，mock 通道=false）：false 时购买入口
     *  拦截改「联系购买」（2026-08-22 用户拍板：正式支付接入前不走通支付路径）。
     *  随每次 parse（网络/缓存）同步，默认 true 宽容旧服务端。 */
    @Volatile
    var payable: Boolean = true
        private set

    /** 支付模式（2026-08-22 拍板：payable 语义收窄为「在线支付」且服务端恒下发
     *  true——旧版 App 读 payable=false 会拦截；购买入口开合改由本字段驱动）：
     *  "online"=在线支付通道（虎皮椒）/ "manual"=人工支付（闲鱼担保交易，下单后
     *  跳订单页）/ "none"=不开放购买（服务端不会下发，客户端兜底拦截）。
     *  默认 "online" 宽容旧服务端。 */
    @Volatile
    var payMode: String = "online"
        private set

    /** 组合折扣表（2026-08-22 原生化拍板：服务端单一事实源下发 [{n,r}]，本地
     *  实时算价与后端 ComboTotalCents HALF_UP 同口径）。空=服务端未下发（旧
     *  服务端），组合购买区按不可用处理。 */
    @Volatile
    var comboRates: List<Pair<Int, Int>> = emptyList()
        private set

    /** 原生下单灰度 flag（服务端 meta 可配）：false=走旧 WebView 链路（弹窗+
     *  /shop），true=原生选购页/订单中心。出问题服务端关 flag 即回滚不发版。
     *  默认 false 宽容旧服务端。 */
    @Volatile
    var nativeCheckout: Boolean = false
        private set

    /** 闲鱼商品链接（管理台配置下发，App 支付引导页/联系客服页拉起目标；空=对应按钮隐藏） */
    @Volatile
    var xianyuUrl: String = ""
        private set

    /** 闲鱼商品 id（2026-10-08 唤端改造：服务端后台解析 xianyu_item_url 落地页下发；
     *  非空时 fleamarket://item?id= 直拉商品页（真机实测唯一「拉起+进商品页」路径），
     *  空=解析失败/未就绪，调用方退 xianyuUrl 现状链接） */
    @Volatile
    var xianyuItemId: String = ""
        private set

    /** 客服通用链接（2026-09 管理台新增配置，App 关于-联系客服原生页「联系客服」按钮拉起；
     *  空=该按钮隐藏。链接形态约定为 https 网页 URL，后台改仅需改链接，不发版） */
    @Volatile
    var contactUrl: String = ""
        private set

    /** 客服服务时段文案（安全文案随迁：支付引导页展示） */
    @Volatile
    var serviceHours: String = ""
        private set

    // 扩展字段合并入口 applyExtFields 已删（4.7.2 方案 A：/api/skus 单接口目录+
    // 六字段一体下发，parseSkuList 单源解析；原宿主双拉 /jp/skus-ext 及 SkuExtSync
    // 随源合并退役，SDK 无保留必要）。

    /** 响应体 → SKU 列表（纯函数；格式不符返回空表，不抛；顺带解析 payable/pay_mode/
     *  combo_rates/native_checkout/xianyu_url/contact_url/service_hours） */
    fun parseSkuList(json: String): List<Sku> = runCatching {
        val root = JSONObject(json)
        payable = root.optBoolean("payable", true)
        payMode = root.optString("pay_mode", "online")
        nativeCheckout = root.optBoolean("native_checkout", false)
        xianyuUrl = root.optString("xianyu_url", "")
        xianyuItemId = root.optString("xianyu_item_id", "")
        contactUrl = root.optString("contact_url", "")
        serviceHours = root.optString("service_hours", "")
        comboRates = root.optJSONArray("combo_rates")?.let { arr ->
            (0 until arr.length()).mapNotNull { i ->
                runCatching {
                    val o = arr.getJSONObject(i)
                    o.getInt("n") to o.getInt("r")
                }.getOrNull()
            }
        } ?: emptyList()
        val arr = root.optJSONArray("skus") ?: return emptyList()
        (0 until arr.length()).mapNotNull { i ->
            val o = arr.getJSONObject(i)
            runCatching {
                val appsArr = o.optJSONArray("apps")
                val appsLen = appsArr?.length() ?: 0
                Sku(
                    id = o.getString("id"),
                    name = o.getString("name"),
                    // elvis 必须括号包住再 until（审查 C2：infix until 优先级高于 ?:，
                    // 裸写 0 until x?.length() ?: 0 是类型错编译必炸）
                    apps = (0 until appsLen).map { appsArr!!.getString(it) },
                    tier = o.optString("tier", ""),
                    days = o.optInt("days", 0),
                    deviceLimit = o.optInt("device_limit", 1),
                    priceCents = o.optInt("price_cents", 0)
                )
            }.getOrNull()
        }
    }.getOrDefault(emptyList())

    /**
     * 按 App 维度分组（纯函数）：apps 同时含 fanqie+hongguo → 全家桶组；单 App →
     * 各自组；其它 apps 组合 → 独立组。组内按 days 升序（永久 days=0 排最后）；
     * 组间显式固定序（all → fanqie → hongguo → 其它，审查 S5：防调价让主打组
     * 位置随服务端价格序漂移）。
     */
    fun groupByApps(skus: List<Sku>): List<PlanGroup> {
        val groups = LinkedHashMap<String, MutableList<Sku>>()
        for (s in skus) {
            val key = when {
                s.apps.contains("fanqie") && s.apps.contains("hongguo") -> "all"
                s.apps.size == 1 -> s.apps[0]
                else -> s.apps.sorted().joinToString(",")
            }
            groups.getOrPut(key) { ArrayList() }.add(s)
        }
        val order = listOf("all", "fanqie", "hongguo")
        val sortedKeys = groups.keys.sortedBy { key ->
            val idx = order.indexOf(key)
            if (idx >= 0) idx else order.size
        }
        return sortedKeys.map { key ->
            val title = when (key) {
                "all" -> FAMILY_CN
                else -> APP_CN[key] ?: key
            }
            PlanGroup(
                key = key,
                title = title,
                skus = groups.getValue(key).sortedWith(compareBy({ if (it.days <= 0) Int.MAX_VALUE else it.days }, { it.id }))
            )
        }
    }

    /** 省钱锚定三段式数据（审查 S1：锚定需展示对比基准，只给结论值用户感知不到省在哪） */
    data class SavingsHint(
        val sumSingleCents: Int, // 单 App 同档合计价
        val familyCents: Int,    // 全家桶同档价
        val savingsCents: Int    // 差值
    )

    /**
     * 省钱锚定（决策 #19，纯函数）：逐档比较「单 App 合计价」vs「全家桶同档价」，
     * 取最大正差值档返回三段数据（null = 无全家桶或全家桶无省钱优势，调用方隐藏锚定行）。
     * 单 App 合计 = 所有单 App 组（非全家桶）同 days 价格之和。
     */
    fun bestFamilySavings(skus: List<Sku>): SavingsHint? {
        val family = skus.filter { it.apps.contains("fanqie") && it.apps.contains("hongguo") }
        if (family.isEmpty()) return null
        val singles = skus.filter { !(it.apps.contains("fanqie") && it.apps.contains("hongguo")) }
        return family.mapNotNull { fam ->
            val sumSingle = singles.filter { it.days == fam.days }.sumOf { it.priceCents }
            (sumSingle - fam.priceCents).takeIf { it > 0 }
                ?.let { SavingsHint(sumSingle, fam.priceCents, it) }
        }.maxByOrNull { it.savingsCents }
    }

    /** 拉取 SKU（IO 线程）；成功即写缓存，返回解析结果 */
    suspend fun fetch(context: Context): Result<List<Sku>> = withContext(Dispatchers.IO) {
        runCatching {
            val conn = URL(ActivationSdk.apiBase.trimEnd('/') + "/api/skus")
                .openConnection() as HttpURLConnection
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS
            conn.setRequestProperty("X-Product", ActivationSdk.productId)   // X-Product 通道（批次2，v1.2）
            if (conn.responseCode != 200) {
                conn.disconnect()
                error("skus http ${conn.responseCode}")
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            val skus = parseSkuList(body)
            if (skus.isEmpty()) error("skus empty")
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(K_SKU_CACHE, body)
                .putLong(K_SKU_CACHE_AT, System.currentTimeMillis())
                .apply()
            skus
        }
    }

    /** 读本地缓存（离线渲染用）；无缓存返回 null。缓存无失效期（离线兜底），
     *  [cacheAgeMs] 供 UI 标注「价格以支付页为准」（S3：>7 天必拉新失败才静默用旧）。
     *  契约锚定（4.7.2 三角色审查 I-3）：本方法经 parseSkuList 兼具「恢复六字段
     *  内存态」职责——购买路由判定前必须先调本方法（或 fetch），离线冷启动的
     *  payMode/nativeCheckout 恢复依赖此副作用，拆解析时须保留该语义 */
    fun cached(context: Context): List<Sku>? {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = p.getString(K_SKU_CACHE, null) ?: return null
        return parseSkuList(json).takeIf { it.isNotEmpty() }
    }

    /** 缓存年龄（毫秒）；无缓存返回 Long.MAX_VALUE */
    fun cacheAgeMs(context: Context): Long {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val at = p.getLong(K_SKU_CACHE_AT, 0L)
        return if (at == 0L) Long.MAX_VALUE else System.currentTimeMillis() - at
    }

    /** 价格分 → 元字符串（两位小数），如 1200 → "12.00" */
    fun yuan(cents: Int): String = String.format(java.util.Locale.CHINA, "%.2f", cents / 100.0)

    /** 折扣率文案：900‰ → "9折" / 850‰ → "8.5折"（与后端 DiscountLabel 同口径） */
    fun rateLabel(rate: Int): String =
        if (rate % 100 == 0) "${rate / 100}折" else String.format(java.util.Locale.CHINA, "%.1f折", rate / 1000.0)

    /** 组合算价（本地实时，与后端 ComboTotalCents HALF_UP 同口径）：
     *  sum × rateFor(appCount) / 1000 四舍五入只舍一次。折扣档按 App 去重数（与
     *  后端 DiscountPerMille(len(items)) 同构，family SKU 混选也不漂移）；无折扣
     *  表时返回原价和。 */
    fun comboTotalCents(prices: List<Int>, appCount: Int = prices.size): Int {
        val sum = prices.sum()
        val rate = rateFor(appCount)
        if (rate >= 1000) return sum
        return Math.round(sum * rate / 1000.0).toInt()
    }

    /** 折扣表匹配（倒序取首个 n<=count 的档，与后端 rateFor 逻辑一致）；无表=无折扣 */
    fun rateFor(appCount: Int): Int {
        for (i in comboRates.indices.reversed()) {
            if (appCount >= comboRates[i].first) return comboRates[i].second
        }
        return 1000
    }
}
