/*
 * v1.4 解绑结构化通道单测（拾音激活域入口重构批，方案 doc/plans/activation-keyinfo-page.md §2.1）：
 * ①releaseErrCode 三值映射+null 归并 ②releaseFailMessage 文案逐字回归（旧宿主消费的
 * Result.message/String? 即此文案，共用 err 提取重构最易漂移，快照锁定）。成功路径
 * clearKey 行为不属纯 JVM 可测面，由真机冒烟盖（README 检查单第 5 步）。
 */
package top.astock.activation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleaseOutcomeTest {

    // ① errCode 映射：服务端三结构化值透传；空/未识别/服务异常归 null（=非结构化应答）
    @Test
    fun testReleaseErrCode() {
        assertEquals("not_bound", EntitlementManager.releaseErrCode("not_bound"))
        assertEquals("trial_no_release", EntitlementManager.releaseErrCode("trial_no_release"))
        assertEquals("release_limit", EntitlementManager.releaseErrCode("release_limit"))
        assertNull(EntitlementManager.releaseErrCode(""))
        assertNull(EntitlementManager.releaseErrCode("internal"))
        assertNull(EntitlementManager.releaseErrCode("whatever_unknown"))
    }

    // ② 文案逐字回归：v1.3 及之前 releaseDevice/releaseRemote when 分支原文（快照锁定，
    // 任何措辞改动都意味着旧宿主（净屏 KeyInfo toast）用户可见文案变化，须明示拍板）
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
            "解绑次数已用完（每 30 天限 1 次），请联系客服协助",
            EntitlementManager.releaseFailMessage("release_limit", 429, remote = false),
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
            "解绑次数已用完（每 30 天限 1 次），请联系客服协助",
            EntitlementManager.releaseFailMessage("release_limit", 429, remote = true),
        )
    }
}
