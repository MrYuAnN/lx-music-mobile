/*
 * v1.4 解绑结构化通道单测（拾音激活域入口重构批，方案 doc/plans/activation-keyinfo-page.md §2.1）：
 * ①releaseErrCode 结构化值映射+null 归并 ②releaseFailMessage 文案回归（not_bound/
 * trial_no_release 逐字锚 v1.3 原文；release_limit 口径随窗口演进逐次锚拍板：
 * 2026-11-03 滚动窗 4176cbf、2026-11-18 自然月拍板；release_mismatch 锚 2026-11-26
 * 解绑三元组闸拍板——快照锁改动须明示拍板）。
 * ③releaseYmOf 东八区年月边界（2026-11-18 自然月批：月初/跨年/UTC 差异点）。
 * 成功路径 clearKey/markSelfReleaseMonth（SP）不属纯 JVM 可测面，由真机冒烟盖
 * （README 检查单第 5 步）。
 */
package top.astock.activation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class ReleaseOutcomeTest {

    // ① errCode 映射：服务端结构化值透传；空/未识别/服务异常归 null（=非结构化应答）
    @Test
    fun testReleaseErrCode() {
        assertEquals("not_bound", EntitlementManager.releaseErrCode("not_bound"))
        assertEquals("trial_no_release", EntitlementManager.releaseErrCode("trial_no_release"))
        assertEquals("release_limit", EntitlementManager.releaseErrCode("release_limit"))
        assertEquals("release_mismatch", EntitlementManager.releaseErrCode("release_mismatch"))
        assertNull(EntitlementManager.releaseErrCode(""))
        assertNull(EntitlementManager.releaseErrCode("internal"))
        assertNull(EntitlementManager.releaseErrCode("whatever_unknown"))
    }

    // ② 文案回归：not_bound/trial_no_release 锁 v1.3 原文（快照锁定，任何措辞改动都
    // 意味着旧宿主（净屏 KeyInfo toast）用户可见文案变化，须明示拍板）；release_limit
    // 锁 2026-11-18 自然月口径文案（每 30 天→每自然月，平台仓闸判定同批改）
    @Test
    fun testReleaseFailMessageWording() {
        // 本机解绑四态
        assertEquals(
            "该激活码未绑定本机（可能是已被新激活码顶替，或在其他设备解绑），无需重复解绑",
            EntitlementManager.releaseFailMessage("not_bound", 404, remote = false),
        )
        assertEquals(
            "体验卡为一次性试用权益，不支持解绑或转移设备，如需更换设备请联系客服协助",
            EntitlementManager.releaseFailMessage("trial_no_release", 403, remote = false),
        )
        assertEquals(
            "本月解绑次数已用完（每自然月限 1 次，次月 1 日恢复），如需提前解绑请联系客服",
            EntitlementManager.releaseFailMessage("release_limit", 429, remote = false),
        )
        // release_mismatch（2026-11-26 解绑三元组闸）：闸的目标面（他机/克隆解绑）与
        // 合法误伤面（本机刷机/隐私 ROM 锚改写）共用一条文案，统一引导客服
        assertEquals(
            "本机与该激活码的绑定记录不一致，无法解绑；如需换绑设备请联系客服协助",
            EntitlementManager.releaseFailMessage("release_mismatch", 403, remote = false),
        )
        assertEquals(
            "服务异常（500），请稍后再试",
            EntitlementManager.releaseFailMessage("internal", 500, remote = false),
        )
        // 远程解绑：仅 not_bound 措辞不同，其余三态同文本
        assertEquals(
            "该设备已不在此码名下，刷新后查看最新列表",
            EntitlementManager.releaseFailMessage("not_bound", 404, remote = true),
        )
        assertEquals(
            "本月解绑次数已用完（每自然月限 1 次，次月 1 日恢复），如需提前解绑请联系客服",
            EntitlementManager.releaseFailMessage("release_limit", 429, remote = true),
        )
    }

    // ③ 东八区年月边界（自然月窗口的客户端判定单源）：月初 0 点整归新月、月末尾秒
    // 归当月、跨年同月内；UTC 与东八区差 8h——UTC 月末 16:00 起东八区已进次月
    // （时区差异点，防改设备时区薅额度的实现依据）
    @Test
    fun testReleaseYmOfCstBoundary() {
        fun epochAt(y: Int, mo: Int, d: Int, h: Int, mi: Int, s: Int): Long {
            val cal = Calendar.getInstance(TimeZone.getTimeZone("GMT+08:00"))
            cal.clear()
            cal.set(y, mo - 1, d, h, mi, s)
            return cal.timeInMillis
        }
        assertEquals("2026-11", EntitlementManager.releaseYmOf(epochAt(2026, 11, 18, 12, 0, 0)))
        assertEquals("2026-12", EntitlementManager.releaseYmOf(epochAt(2026, 12, 1, 0, 0, 0)))
        assertEquals("2026-11", EntitlementManager.releaseYmOf(epochAt(2026, 11, 30, 23, 59, 59)))
        assertEquals("2027-01", EntitlementManager.releaseYmOf(epochAt(2027, 1, 1, 0, 0, 30)))
        assertEquals("2026-03", EntitlementManager.releaseYmOf(epochAt(2026, 3, 15, 8, 0, 0)))
        // 时区差异点：2026-11-30 16:00 UTC = 东八区 2026-12-01 00:00 → 已进次月
        val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        utc.clear()
        utc.set(2026, 10, 30, 16, 0, 0)
        assertEquals("2026-12", EntitlementManager.releaseYmOf(utc.timeInMillis))
    }
}
