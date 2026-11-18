/*
 * 激活族 200 响应本地校验失败拆分单测（2026-11-18 拆分批，纯 JVM）：
 * ①diag 载荷构造纯函数全字段断言（buildVerifyFailDiag——验签分支的载荷单源）；
 * ②解析异常分支端到端（v2 receipt 缺 exps → MSG_RESP_PARSE/ERR_RESP_PARSE）。
 * 验签失败分支的接线（verify=false → Failure(MSG_SIG_VERIFY, ERR_SIG_VERIFY,
 * diag=buildVerifyFailDiag)）为 3 行直查代码，JVM 桩（returnDefaultValues）下
 * android.util.Base64 恒 null 不可达，不入纯 JVM 断言——分支真值由真实设备
 * diag 上报自证（op_log kind=verify-fail 到达即接线成立）。
 * 本测 ActivationSdk.init 注入 dummy 公钥（activation-sdk 模块测试独立 gradle
 * task 运行，与 app 模块测试静态态互不可见）。
 */
package top.astock.activation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test

class ActivationRespSplitTest {

    companion object {
        private const val DUMMY_PUB = "aabbccee00112233445566778899aabbccddeeff00112233445566778899aabb"
        private const val API_BASE = "https://api.test"
        private const val NOW = 1_700_000_000L
        private const val KEY = "JP-TESTKEY-AAAAA-BBBBB-CCCCC"
        private const val DID = "27ebf686661d2f857308f60c9687166b96daa4cc47412fb19a1655b40c40e466"

        @JvmStatic
        @BeforeClass
        fun initSdk() {
            top.astock.activation.ActivationSdk.init(
                apiBase = API_BASE,
                productId = "jingping",
                deviceSalt = "salt-test",
                servicePubkeyHex = DUMMY_PUB,
                xClientVersion = "1.8.1",
            )
        }

        /** activationResp 同构根（v2 receipt 形状与平台 activationResp 一致） */
        private fun root(withExps: Boolean): JSONObject {
            val rc = JSONObject()
            rc.put("kid", KEY)
            rc.put("did", DID)
            rc.put("ver", 2)
            rc.put("apps", org.json.JSONArray(listOf("fanqie")))
            if (withExps) rc.put("exps", JSONObject(mapOf("fanqie" to NOW + 86_400)))
            rc.put("tier", "m1")
            rc.put("exp", NOW + 86_400)
            rc.put("iat", NOW)
            rc.put("sig", "A".repeat(88))
            return JSONObject(
                mapOf(
                    "key_id" to KEY,
                    "tier" to "m1",
                    "entitlement_kind" to "paid",
                    "expires_at" to NOW + 86_400,
                    "device_limit" to 1,
                    "expiries" to JSONObject(mapOf("fanqie" to NOW + 86_400)),
                    "receipt" to rc,
                )
            )
        }
    }

    /** ①diag 构造纯函数：全字段形状/归因断言（排查批 2026-11-18 定案形态） */
    @Test
    fun testBuildVerifyFailDiagFields() {
        val rc = JSONObject()
        rc.put("iat", NOW)
        rc.put("did", DID)
        val canonical = "$KEY|$DID|2|fanqie|fanqie:${NOW + 86_400}|m1|${NOW + 86_400}|$NOW"
        val diag = EntitlementManager.buildVerifyFailDiag(DUMMY_PUB, canonical, rc, KEY, API_BASE)
        assertEquals(DUMMY_PUB.take(8), diag.optString("pk_fp"))
        assertEquals(8, diag.optString("canon_hash").length)
        assertEquals(DID, diag.optString("did"))
        assertEquals(KEY, diag.optString("key"))
        assertEquals(API_BASE, diag.optString("base"))
        // skew=iat-本地钟：NOW 远在过去 → 大负值（只验量级不锁死具体钟）
        val skew = diag.optLong("skew")
        assertTrue("skew 应为大负值（iat 远早于测试钟），got $skew", skew < -1_000_000L)
    }

    /** ②解析异常分支端到端：v2 receipt 缺 exps → 拆分文案+errCode（无 diag） */
    @Test
    fun testParseFailBranchSplitsMessageCode() {
        val r = EntitlementManager.parseActivationRespForTest(root(withExps = false).toString())
        assertTrue("应命中 Failure", r is EntitlementManager.AuthResult.Failure)
        r as EntitlementManager.AuthResult.Failure
        assertEquals(EntitlementManager.MSG_RESP_PARSE, r.userMessage)
        assertEquals(EntitlementManager.ERR_RESP_PARSE, r.errCode)
        assertNull("解析异常分支不携带 diag", r.diag)
    }
}
