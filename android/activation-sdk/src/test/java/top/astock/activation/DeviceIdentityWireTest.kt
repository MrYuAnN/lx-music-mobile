/*
 * 设备身份三元组单测（2026-11-24，服务端三元组改造 P2；同批代码审查后修订）。
 * 锁面=三件「看起来能省、省了就静默失效」的事：
 *   ① 两键（device_name / drm_id）必须**同时显式出现**——服务端按「键是否存在」区分
 *      新旧客户端；无 Widevine 时 drm_id 为空串也要带，不能省键；
 *   ② 六个端点的请求体都由 identityPayload 单源补齐，任一处漏接即测试红（原版只锁
 *      纯函数，漏接线仍全绿——审查 S-2）；
 *   ③ DRM 读取失败必须复用上次成功锚，不能把「读不到」当成「没有 Widevine」——
 *      否则 strict 下会被判成另一台机器（审查 I-1）。
 * 全部纯函数/JSONObject，不触 Android Framework，JVM 单测可跑。
 */
package top.astock.activation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceIdentityWireTest {

    @Test
    fun identityPairsAlwaysCarryBothKeys() {
        val p = EntitlementManager.deviceIdentityPairs("Pixel 7", "")
        assertEquals(2, p.size)
        assertEquals("Pixel 7", p["device_name"])
        assertEquals("", p["drm_id"]) // 空锚也要在，不能只剩 device_name
    }

    @Test
    fun identityPairsKeepEmptyDrmKeyInJson() {
        val o = JSONObject(EntitlementManager.deviceIdentityPairs("M", ""))
        assertTrue(o.has("device_name"))
        assertTrue(o.has("drm_id"))
        assertEquals("", o.optString("drm_id"))
    }

    // ② 六个装配点共用 identityPayload：逐端点断言两键在、base 键不丢（本批核心回归锁）
    @Test
    fun identityPayloadWiresAllEndpoints() {
        val bases = listOf(
            "activate" to mapOf("key" to "JP-A", "device_id" to "dev-1", "intent" to "bind"),
            "binding-check" to mapOf("key" to "JP-A", "device_id" to "dev-1"),
            "entitlements" to mapOf("key" to "JP-A", "device_id" to "dev-1"),
            "code-overlap" to mapOf("code" to "JP-B", "device_id" to "dev-1"),
            "trial-claim" to mapOf("device_id" to "dev-1"),
            "redeem-fallback" to mapOf("key" to "JP-A", "device_id" to "dev-1"),
        )
        for ((name, base) in bases) {
            val o = EntitlementManager.identityPayload(base, "Pixel 7", "")
            assertTrue("$name 缺 device_name 键", o.has("device_name"))
            assertTrue("$name 缺 drm_id 键", o.has("drm_id"))
            assertEquals("$name device_name 值", "Pixel 7", o.optString("device_name"))
            assertEquals("$name 空锚也必须保留键", "", o.optString("drm_id"))
            for (k in base.keys) assertTrue("$name 丢了 base 键 $k", o.has(k))
        }
    }

    // ③ 读失败复用缓存；成功则用新值；从未成功过返回空（真·无 Widevine）
    @Test
    fun drmIdFallsBackToCachedOnReadFailure() {
        assertEquals("cached", EntitlementManager.resolveDrmId("", "cached"))
        assertEquals("fresh", EntitlementManager.resolveDrmId("fresh", "cached"))
        assertEquals("", EntitlementManager.resolveDrmId("", ""))
    }

    @Test
    fun restoreUrlCarriesBothParamsEvenWhenEmpty() {
        val u = EntitlementManager.restoreUrl("https://jp.a-stock.top", "dev-1", "", "")
        assertTrue(u, u.contains("device_id=dev-1"))
        assertTrue(u, u.contains("&device_name=&"))
        assertTrue(u, u.endsWith("&drm_id="))
    }

    @Test
    fun restoreUrlEncodesModelAndAnchor() {
        val u = EntitlementManager.restoreUrl("https://x/", "dev 1", "小米 15", "a&b")
        assertTrue(u, u.startsWith("https://x/api/restore?device_id=dev+1&"))
        // 空格编码按 URLEncoder 契约是 '+'；容忍未来换成 %20（服务端两者都解码为空格）
        assertTrue(
            u,
            u.contains("device_name=%E5%B0%8F%E7%B1%B3+15") || u.contains("device_name=%E5%B0%8F%E7%B1%B3%2015"),
        )
        assertTrue(u, u.contains("drm_id=a%26b"))
    }

    // ④ claim 的 409 分派：三元组不符是终态（不导航 restore），与 trial_has_license 分开
    @Test
    fun trial409DispatchSeparatesDeviceMismatch() {
        val mismatch = """{"error":"trial_device_mismatch"}"""
        val hasLicense = """{"error":"trial_has_license"}"""
        assertTrue(EntitlementManager.trial409IsDeviceMismatch(mismatch))
        assertTrue(!EntitlementManager.trial409WantsRestore(mismatch))
        assertTrue(!EntitlementManager.trial409IsDeviceMismatch(hasLicense))
        assertTrue(EntitlementManager.trial409WantsRestore(hasLicense))
        assertTrue(!EntitlementManager.trial409IsDeviceMismatch("not json"))
    }
}
