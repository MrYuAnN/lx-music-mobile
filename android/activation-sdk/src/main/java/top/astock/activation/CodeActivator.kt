/*
 * 净屏 - 激活码批量激活（2026-08-22 原生化改造：从 PayWebViewActivity 抽出复用）
 * 基于 RethinkDNS (Apache-2.0) 二次开发
 *
 * 订单中心 delivered 订单与支付 WebView 的 JS 桥共用同一激活链路：
 * 逐个激活（JP- 前缀走 /activate、CZ- 走 /redeem），任一成功即整体成功；
 * 全部失败返回首个错误文案（调用方负责 UI 兜底）。
 *
 * 2026-11-23 订单自动激活批：
 *  - 逐码结果（PerCode）：自动路径需要「部分成功保留剩余码」，仅聚合结果不够；
 *  - errCode 透传：失败分类按结构化错误码，不再依赖中文文案子串；
 *  - 按码单飞 + 临界区重查：并发第二调用者返回 ALREADY_HELD（幂等成功），
 *    不会拿到「该激活码已使用过」的假失败。
 */
package top.astock.activation

import android.content.Context
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray

object CodeActivator {

    /** 单码结果（自动激活分类/重试的输入） */
    data class PerCode(
        val code: String,
        val kind: Kind,
        val errCode: String? = null,
        val message: String? = null,
    ) {
        enum class Kind { ACTIVATED, ALREADY_HELD, FAILED }

        /** 已兑现（刚激活或本机已持有） */
        val ok: Boolean get() = kind != Kind.FAILED
    }

    /** 批量激活结果（Success/Failure 字段向后兼容旧调用方） */
    sealed class Outcome {
        /** 任一码成功（codes 为成功激活的码；results 为逐码明细） */
        data class Success(
            val codes: List<String>,
            val results: List<PerCode> = emptyList(),
        ) : Outcome()

        /** 全部失败（message=首个用户可读错误；errCode/results 供自动路径分类） */
        data class Failure(
            val message: String,
            val codes: List<String>,
            val errCode: String? = null,
            val results: List<PerCode> = emptyList(),
        ) : Outcome()

        /** 码列表为空（无需激活） */
        object Empty : Outcome()
    }

    /** 按码单飞锁（同进程；手动/自动/桥三路径共用） */
    private val codeLocks = ConcurrentHashMap<String, Mutex>()

    /** 逐个激活：JP- 前缀走 /activate、CZ- 走 /redeem（服务端 PoolIDs 顺序即先 JP 后 CZ）。
     *  userInitiated（方案 v3 批B1 审查 C-3，2026-11-27）：仅用户主动点击路径传 true
     *  （订单中心一键激活）；自动链（OrderAutoActivation 回前台补拉）传 false——
     *  其对 426 upgrade_required 的既有语义=静默 blockedCodes 24h 重试，不拉强更页。 */
    suspend fun activate(context: Context, codes: List<String>, userInitiated: Boolean = true): Outcome {
        if (codes.isEmpty()) return Outcome.Empty
        val results = codes.map { activateOne(context, it, userInitiated) }
        val okCodes = results.filter { it.ok }.map { it.code }
        return if (okCodes.isNotEmpty()) {
            Outcome.Success(okCodes, results)
        } else {
            val first = results.firstOrNull { !it.ok }
            Outcome.Failure(
                first?.message ?: "激活失败，请稍后重试",
                codes,
                first?.errCode,
                results
            )
        }
    }

    private suspend fun activateOne(context: Context, code: String, userInitiated: Boolean): PerCode {
        val normalized = code.trim().uppercase().replace(" ", "")
        val lock = codeLocks.computeIfAbsent(normalized) { Mutex() }
        return lock.withLock {
            // 临界区重查：并发第二调用者应得到幂等成功，而非「已使用过」失败
            if (EntitlementManager.isCodeActivatedLocally(context, normalized)) {
                return@withLock PerCode(code, PerCode.Kind.ALREADY_HELD)
            }
            when (val r = EntitlementManager.activateOrRedeem(context, code, userInitiated = userInitiated)) {
                is EntitlementManager.AuthResult.Success ->
                    PerCode(code, PerCode.Kind.ACTIVATED)
                is EntitlementManager.AuthResult.Failure ->
                    PerCode(code, PerCode.Kind.FAILED, r.errCode, r.userMessage)
            }
        }
    }

    /** 码参数容错解析（桥侧/订单侧双用）：合法 JSON 数组 → 元素表；否则去引号按
     *  逗号拆；再否则整体单码（桥参数 ToString 拍扁形态不再让整链失效，审查 C2） */
    fun parseCodes(codesJson: String): List<String> {
        runCatching {
            val arr = JSONArray(codesJson)
            return (0 until arr.length()).mapNotNull { arr.optString(it).takeIf { it.isNotBlank() } }
        }
        val cleaned = codesJson.trim().trim('"', '\'', '[', ']', ' ')
        if (cleaned.isEmpty()) return emptyList()
        return cleaned.split(',').map { it.trim().trim('"', '\'') }.filter { it.isNotBlank() }
    }
}
