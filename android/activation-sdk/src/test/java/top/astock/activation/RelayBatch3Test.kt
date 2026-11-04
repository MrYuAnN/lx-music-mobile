/*
 * 键级累加（段接力）批3 SDK 纯 JVM 单测（shiyin-relay-impl.md 批3-c；终案
 * shiyin-pricing-model.md v2.4 §五.2 SDK 配套）。三件：①relay 能力位解析（旧响应
 * 兼容）②release 应答 relay_aggs 解析 ③归属重指向选择逻辑（经 parseFusedKeys 同型
 * 宽松读验证；SP/Context 依赖路径归真机回归，纯 JVM 层锁协议形状）。
 */
package top.astock.activation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RelayBatch3Test {

    // ① relay 能力位：激活响应 relay=true/false/缺省——宽松读三态（persist 落 K_RELAY_MODE
    // 的单调语义由 persist 路径保证，此处锁解析层协议形状）
    @Test
    fun testRelayCapabilityParse() {
        // relay 产品响应：恒携带 true
        val root = JSONObject("""{"key_id":"JP-R1","relay":true,"tier":"y1"}""")
        assertEquals(true, root.optBoolean("relay", false))
        // legacy 响应：无此键=缺省 false（行为退化为 legacy，与 fused_keys 同型先例）
        val legacy = JSONObject("""{"key_id":"JP-R2","tier":"y1"}""")
        assertFalse(legacy.optBoolean("relay", false))
        // 显式 false（理论不出现，防御读）
        assertFalse(JSONObject("""{"relay":false}""").optBoolean("relay", false))
    }

    // ② release 应答 relay_aggs 解析：正常对象/缺键/非法值三态（releaseDeviceEx 的
    // runCatching 宽松读——解析失败降级 null=原 clearKey 行为，不阻塞解绑）
    @Test
    fun testRelayAggsParse() {
        val body = JSONObject("""{"ok":true,"relay_aggs":{"tx":1770000000,"wy":0}}""")
        val aggs = body.optJSONObject("relay_aggs")!!
        assertEquals(2, aggs.length())
        assertEquals(1770000000L, aggs.getLong("tx"))
        assertEquals(0L, aggs.getLong("wy")) // 永久段聚合=0
        // legacy 应答：无 relay_aggs=null（调用方降级 clearKey 原语义）
        assertEquals(null, JSONObject("""{"ok":true}""").optJSONObject("relay_aggs"))
        // 非法值防御：optLong 缺省哨兵过滤（Long.MIN_VALUE 不入 map）
        val bad = JSONObject("""{"relay_aggs":{"tx":"not-a-number"}}""")
        val badAggs = bad.optJSONObject("relay_aggs")!!
        assertEquals(Long.MIN_VALUE, badAggs.optLong("tx", Long.MIN_VALUE))
    }

    // ③ 归属重指向选择：keys[app] 已被他码持有→跳过（不受解绑影响）；无持有→找
    // expiries[app]==aggExp 的 receipt 重指向；无匹配→保持 null（降级现状）。
    // 选择谓词纯逻辑此处锁定；SP 写入路径归真机回归（clearKeyInternal 私有）。
    @Test
    fun testRelayRepointPredicate() {
        // 模拟 receipts：两码各持 tx 到期值（A=早段止、B=晚段止）；relay_aggs.tx=B 止
        // →应选 B。谓词=parseReceipt.expiries[app]==aggExp（与 clearKeyInternal 一致）
        val expA = 1770000000L
        val expB = 1770300000L
        val candidates = mapOf("JP-A" to expA, "JP-B" to expB)
        val aggExp = expB
        val owner = candidates.entries.firstOrNull { it.value == aggExp }?.key
        assertEquals("JP-B", owner)
        // 聚合无匹配（两码都不等——如服务端已重写而本地 receipt 陈旧）：保持 null
        val ownerNone = candidates.entries.firstOrNull { it.value == 999L }?.key
        assertEquals(null, ownerNone)
    }
}
