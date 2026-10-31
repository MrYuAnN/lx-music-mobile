/*
 * 组1 契约一条龙·块4（2026-10-15）：claim 编排五件纯 JVM 单测（方案 v2.1 拍板——
 * 回流前先铺测试网；不依赖 Android Framework，统一在 App 仓 gradle 工程执行）。
 * 五件=①退避序列 ②409→restore 接管分派 ③三触发点单飞去重 ④权益监听注册/触发
 * ⑤persist→parseReceipt 往返不丢字段。
 * 注：退避序列 10s→5min→30min→6h 为现状锁定（2026-10-13/14 拍板），非业界
 * 指数退避+jitter 惯例——未来调整须先对标再动（方案 S5 注记）。
 */
package top.astock.activation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ClaimOrchestrationTest {

    // ① 退避序列：首试（last=0）放行；窗口内拦截；窗口外放行；fails 封顶取末档
    @Test
    fun testTrialBackoffSequence() {
        assertEquals(10_000L, EntitlementManager.trialBackoffMs(0))
        assertEquals(5 * 60_000L, EntitlementManager.trialBackoffMs(1))
        assertEquals(30 * 60_000L, EntitlementManager.trialBackoffMs(2))
        assertEquals(6 * 3_600_000L, EntitlementManager.trialBackoffMs(3))
        assertEquals(6 * 3_600_000L, EntitlementManager.trialBackoffMs(99)) // 封顶
        // 首试（lastAt=0）恒放行：无网/失败首启的回前台快速自愈（拍板③）
        assertTrue(EntitlementManager.shouldAttemptTrialAt(0, 0L, 0L))
        // 窗口内拦截
        assertFalse(EntitlementManager.shouldAttemptTrialAt(0, 100_000L, 105_000L))
        // 恰到窗口边界放行（>=）
        assertTrue(EntitlementManager.shouldAttemptTrialAt(0, 100_000L, 110_000L))
        // fails=1 已升级 5min 档：10s 后不放行
        assertFalse(EntitlementManager.shouldAttemptTrialAt(1, 100_000L, 120_000L))
        assertTrue(EntitlementManager.shouldAttemptTrialAt(1, 100_000L, 400_000L))
    }

    // ② 409 分派：仅 trial_has_license 导航 restore（审查 S9：防未来 409 增义误判）
    @Test
    fun testTrial409Dispatch() {
        assertTrue(EntitlementManager.trial409WantsRestore("""{"error":"trial_has_license"}"""))
        assertFalse(EntitlementManager.trial409WantsRestore("""{"error":"rate_limited"}"""))
        assertFalse(EntitlementManager.trial409WantsRestore("""{"error":""}"""))
        assertFalse(EntitlementManager.trial409WantsRestore("not json")) // 非法体=不放行
    }

    // ③ 单飞去重：tryBeginClaim CAS 互斥，endClaim 释放
    @Test
    fun testClaimSingleFlight() {
        assertTrue(EntitlementManager.tryBeginClaim())
        // 第二触发点（冷启动/resumeCore/Worker 并发）立即退出
        assertFalse(EntitlementManager.tryBeginClaim())
        assertFalse(EntitlementManager.tryBeginClaim())
        EntitlementManager.endClaim()
        assertTrue(EntitlementManager.tryBeginClaim())
        EntitlementManager.endClaim()
    }

    // ④ 权益监听：注册即收、注销不收、多监听并存（CopyOnWriteArrayList 语义）
    @Test
    fun testEntitlementListeners() {
        val got = mutableListOf<EntitlementManager.EntitlementChange>()
        val l1: (EntitlementManager.EntitlementChange) -> Unit = { got.add(it) }
        val l2: (EntitlementManager.EntitlementChange) -> Unit = { got.add(it) }
        EntitlementManager.registerEntitlementListener(l1)
        EntitlementManager.registerEntitlementListener(l2)
        assertEquals(2, EntitlementManager.listenerCountForTest())
        EntitlementManager.notifyEntitlementChanged(EntitlementManager.EntitlementChange.CLAIMED)
        EntitlementManager.notifyEntitlementChanged(EntitlementManager.EntitlementChange.RESTORED)
        assertEquals(
            listOf(
                EntitlementManager.EntitlementChange.CLAIMED,
                EntitlementManager.EntitlementChange.CLAIMED,
                EntitlementManager.EntitlementChange.RESTORED,
                EntitlementManager.EntitlementChange.RESTORED,
            ),
            got,
        )
        EntitlementManager.unregisterEntitlementListener(l1)
        got.clear()
        EntitlementManager.notifyEntitlementChanged(EntitlementManager.EntitlementChange.CLAIMED)
        assertEquals(1, EntitlementManager.listenerCountForTest())
        assertEquals(listOf(EntitlementManager.EntitlementChange.CLAIMED), got)
        EntitlementManager.unregisterEntitlementListener(l2)
    }

    // ⑤ persist→parseReceipt 往返：落盘形状与解析口径不丢字段（per-app exps/永久 0/
    //    聚合 exp v1 兼容口径/device_limit/kind 语义字段——组1 块4 管道）
    @Test
    fun testPersistParseRoundTrip() {
        val e = EntitlementManager.Entitlement(
            keyId = "JP-RT-1",
            expiries = mapOf("fanqie" to 0L, "hongguo" to 1893456000L),
            tier = "auto3",
            deviceLimit = 3,
            kind = "trial",
        )
        val json = EntitlementManager.buildReceiptJson(e, "dev-hash-x", 1760000000L, 1760000000000L)
        val back = EntitlementManager.parseReceiptForTest(json)
        assertEquals(e.keyId, back?.keyId)
        assertEquals(e.expiries, back?.expiries) // per-app 精确往返（含永久 0）
        assertEquals(e.tier, back?.tier)
        assertEquals(e.deviceLimit, back?.deviceLimit)
        assertEquals("trial", back?.kind)
        assertTrue(back!!.isTrial()) // kind 语义化判定
        // kind 缺失（旧持久化）回落 tier 比对过渡（TRIAL_TIER 退役前兼容）——
        // 结构化移除键构造样本（不依赖序列化键序，防覆盖静默退化）
        val legacy = EntitlementManager.parseReceiptForTest(
            JSONObject(json).apply { remove("kind") }.toString()
        )
        assertTrue(legacy!!.isTrial())
        // 旧持久化正价码：kind 空+tier 非试用 → 非试用
        val legacyPaid = legacy.copy(tier = "m1")
        assertFalse(legacyPaid.isTrial())
        // kind=paid 优先于 tier=auto3（语义字段为真源）
        assertFalse(e.copy(kind = "paid").isTrial())
        // v1 兼容口径：聚合 exp=min 非零
        assertEquals(1893456000L, JSONObject(json).getLong("exp"))
        // 全永久码聚合 exp=0
        val forever = e.copy(expiries = mapOf("fanqie" to 0L))
        assertEquals(0L, JSONObject(EntitlementManager.buildReceiptJson(forever, "d", 1L, 1L)).getLong("exp"))
    }
}
