/*
 * 净屏 - 激活码批量激活（2026-08-22 原生化改造：从 PayWebViewActivity 抽出复用）
 * 基于 RethinkDNS (Apache-2.0) 二次开发
 *
 * 订单中心 delivered 订单与支付 WebView 的 JS 桥共用同一激活链路：
 * 逐个激活（JP- 前缀走 /activate、CZ- 走 /redeem），任一成功即整体成功；
 * 全部失败返回首个错误文案（调用方负责 UI 兜底）。
 */
package top.astock.activation

import android.content.Context
import org.json.JSONArray

object CodeActivator {

    /** 批量激活结果 */
    sealed class Outcome {
        /** 任一码激活成功（codes 为成功激活的码） */
        data class Success(val codes: List<String>) : Outcome()

        /** 全部失败（message=首个用户可读错误） */
        data class Failure(val message: String, val codes: List<String>) : Outcome()

        /** 码列表为空（无需激活） */
        object Empty : Outcome()
    }

    /** 逐个激活：JP- 前缀走 /activate、CZ- 走 /redeem（服务端 PoolIDs 顺序即先 JP 后 CZ） */
    suspend fun activate(context: Context, codes: List<String>): Outcome {
        if (codes.isEmpty()) return Outcome.Empty
        val okCodes = mutableListOf<String>()
        var firstError = ""
        for (code in codes) {
            when (val r = EntitlementManager.activateOrRedeem(context, code)) {
                is EntitlementManager.AuthResult.Success -> okCodes.add(code)
                is EntitlementManager.AuthResult.Failure -> if (firstError.isEmpty()) firstError = r.userMessage
            }
        }
        return if (okCodes.isNotEmpty()) Outcome.Success(okCodes)
        else Outcome.Failure(firstError.ifEmpty { "激活失败，请稍后重试" }, codes)
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
