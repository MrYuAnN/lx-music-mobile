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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceIdentityWireTest {

    @Test
    fun identityPairsAlwaysCarryBothKeys() {
        val p = EntitlementManager.deviceIdentityPairs("Pixel 7", "", "ssaid-1", "L1")
        // v1.8.5 硬件锚 §6.1：四键恒在（三元组两键 + ssaid_anchor + drm_level）
        assertEquals(4, p.size)
        assertEquals("Pixel 7", p["device_name"])
        assertEquals("", p["drm_id"]) // 空锚也要在，不能只剩 device_name
        assertEquals("ssaid-1", p["ssaid_anchor"])
        assertEquals("L1", p["drm_level"])
        // 空值保留：读不到也必须带键（1.8.5 形状判定=带任一新键）
        val e = EntitlementManager.deviceIdentityPairs("M", "", "", "")
        assertEquals("", e["ssaid_anchor"])
        assertEquals("", e["drm_level"])
    }

    @Test
    fun identityPairsKeepEmptyDrmKeyInJson() {
        val o = JSONObject(EntitlementManager.deviceIdentityPairs("M", "", "", ""))
        assertTrue(o.has("device_name"))
        assertTrue(o.has("drm_id"))
        assertEquals("", o.optString("drm_id"))
        // v1.8.5：新两键空值也要保留（JSONObject 空串键不删——删了即回落 legacy/full 判定失效）
        assertTrue(o.has("ssaid_anchor"))
        assertTrue(o.has("drm_level"))
        assertEquals("", o.optString("ssaid_anchor"))
        assertEquals("", o.optString("drm_level"))
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
            val o = EntitlementManager.identityPayload(base, "Pixel 7", "", "ssaid-1", "L1")
            assertTrue("$name 缺 device_name 键", o.has("device_name"))
            assertTrue("$name 缺 drm_id 键", o.has("drm_id"))
            assertEquals("$name device_name 值", "Pixel 7", o.optString("device_name"))
            assertEquals("$name 空锚也必须保留键", "", o.optString("drm_id"))
            // v1.8.5：新两键四端点全带
            assertTrue("$name 缺 ssaid_anchor 键", o.has("ssaid_anchor"))
            assertTrue("$name 缺 drm_level 键", o.has("drm_level"))
            assertEquals("$name ssaid_anchor 值", "ssaid-1", o.optString("ssaid_anchor"))
            assertEquals("$name drm_level 值", "L1", o.optString("drm_level"))
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
        val u = EntitlementManager.restoreUrl("https://jp.a-stock.top", "dev-1", "", "", "", "")
        assertTrue(u, u.contains("device_id=dev-1"))
        assertTrue(u, u.contains("&device_name=&"))
        // v1.8.5：新两参同样空值显式带（服务端 restore 按 q.Has 判 strict）
        assertTrue(u, u.contains("&ssaid_anchor=&"))
        assertTrue(u, u.endsWith("&drm_level=")) // 参数顺序锚：drm_level 恒末位
    }

    @Test
    fun restoreUrlEncodesModelAndAnchor() {
        val u = EntitlementManager.restoreUrl("https://x/", "dev 1", "小米 15", "a&b", "s&c", "L3")
        assertTrue(u, u.startsWith("https://x/api/restore?device_id=dev+1&"))
        // 空格编码按 URLEncoder 契约是 '+'；容忍未来换成 %20（服务端两者都解码为空格）
        assertTrue(
            u,
            u.contains("device_name=%E5%B0%8F%E7%B1%B3+15") || u.contains("device_name=%E5%B0%8F%E7%B1%B3%2015"),
        )
        assertTrue(u, u.contains("drm_id=a%26b"))
        // v1.8.5 新参同编码纪律
        assertTrue(u, u.contains("ssaid_anchor=s%26c"))
        assertTrue(u, u.contains("drm_level=L3"))
    }

    // ④ claim 的 409 分派：三元组不符是终态（不导航 restore），与 trial_has_license 分开
    // trial409DispatchSeparatesDeviceMismatch 已删（2026-11-25 批 3 三端死面撤除：
    // trial409IsDeviceMismatch 随平台零产生点退役，trial409WantsRestore 保留）

    // ⑤ 安装实例签名链（同机判定实体化 §8.2/§15「请求头断言」）：签名串的三元组
    // 与请求体三元组**同源**（signForBody 从 bodyWithIdentity 产物提取）——三键
    // 逐值落进 canonical 对应位置、body 哈希=实际写出字节。锁出口注入约定的
    // 纯函数半程（密钥库半程走 §8.5 实机）。
    @Test
    fun signedCanonicalTripleComesFromIdentityPayload() {
        // v1.8.5：新增 ssaid_anchor/drm_level 不入 canonical 三元组段（restore GET
        // 限制同源 §6.3），但 body.toString() 含新键 → 第 7 段 body 哈希随实际字节覆盖
        val body = EntitlementManager.identityPayload(
            mapOf("key" to "JP-A", "device_id" to "dev-1"), "Pixel 7", "drmX", "ssaidX", "L1",
        )
        val s = InstallationSigner.canonical(
            1L,
            body.optString("device_id"),
            body.optString("device_name"),
            body.optString("drm_id"),
            "POST",
            "/api/activate",
            InstallationSigner.sha256Hex(body.toString().toByteArray()),
        )
        assertTrue(s, s.contains("\ndev-1\nPixel 7\ndrmX\nPOST\n/api/activate\n"))
        assertTrue(s, s.startsWith("1\n"))
        // 第 7 段锁面（审查 S-3）：body 哈希恰为串尾——「哈希=实际写出字节」完整落地
        assertTrue(s, s.endsWith(InstallationSigner.sha256Hex(body.toString().toByteArray())))
        // v1.8.5 负向断言（App 端审查 S-1，两席同提）：新键不得织入 canonical
        // 三元组段（§6.3 已登记限制——防未来 canonical 改动静默脱锚）
        assertFalse(s.contains("L1")) // 级别值不入 canonical（三元组段仅 device_id/机型/drm）
        // 变异锚：改 ssaid 值 → body 哈希变 → canonical 串尾变（新键随第 7 段覆盖的直接证明）
        val body2 = EntitlementManager.identityPayload(
            mapOf("key" to "JP-A", "device_id" to "dev-1"), "Pixel 7", "drmX", "ssaidY", "L1",
        )
        val s2 = InstallationSigner.canonical(
            1L,
            body2.optString("device_id"),
            body2.optString("device_name"),
            body2.optString("drm_id"),
            "POST",
            "/api/activate",
            InstallationSigner.sha256Hex(body2.toString().toByteArray()),
        )
        assertTrue(s2, s2.endsWith(InstallationSigner.sha256Hex(body2.toString().toByteArray())))
        assertTrue(
            "改 ssaid 值应改变 body 哈希段",
            s.takeLast(64) != s2.takeLast(64),
        )
    }
}
