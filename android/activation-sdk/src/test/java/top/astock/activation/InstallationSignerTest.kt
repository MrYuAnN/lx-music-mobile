/*
 * InstallationSigner 纯函数层单测（同机判定实体化方案 v1 §8.4/§15，2026-11-26）：
 * 规范化串逐字节与服务端验签对拍（§15「证明：规范化串逐字节对拍」的客户端半程）、
 * sha256 已知向量、单调时间戳、四头装配。密钥库层（sign/keyEntry）Android only
 * ——§8.5 实机清单验证，JVM 不触。
 */
package top.astock.activation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class InstallationSignerTest {

    // 规范化串逐字节：§8.2 契约 ts\ndid\nname\ndrm\nMETHOD\npath\nsha256(body)
    @Test
    fun canonicalMatchesWireContractByteForByte() {
        val s = InstallationSigner.canonical(
            1795629969L, "dev-1", "Pixel 7", "drmX", "POST", "/api/activate",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        )
        assertEquals(
            "1795629969\ndev-1\nPixel 7\ndrmX\nPOST\n/api/activate\n" +
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            s,
        )
    }

    // 空串字段（Widevine 缺失 drm_id=""、GET body=""）不省略——与服务端按字段位置
    // 切分的解析一致（省了会错位，同 DeviceIdentityWireTest「空锚也要在」锁面）
    @Test
    fun canonicalKeepsEmptyFields() {
        assertEquals(
            "1\n\n\n\nGET\n/api/restore\n" +
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            InstallationSigner.canonical(1L, "", "", "", "GET", "/api/restore", InstallationSigner.sha256Hex(ByteArray(0))),
        )
    }

    // sha256 已知向量（RFC 6234 级锚）
    @Test
    fun sha256KnownVectors() {
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", InstallationSigner.sha256Hex(ByteArray(0)))
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", InstallationSigner.sha256Hex("abc".toByteArray()))
    }

    // 单调时间戳（§8.4）：正常前进=now；时钟回拨=last+1；同秒重签=last+1
    @Test
    fun nextTsIsMonotonic() {
        assertEquals(1795629969L, InstallationSigner.nextTs(1795629969L, 1795629900L))
        assertEquals(1795629901L, InstallationSigner.nextTs(1795629900L, 1795629900L))
        assertEquals(1795629901L, InstallationSigner.nextTs(1795620000L, 1795629900L))
        assertEquals(1L, InstallationSigner.nextTs(0L, 0L))
    }

    // 四头装配（§8.2）：键名与值形态（指纹 hex64/两 b64/ts 秒）
    @Test
    fun headersAssembleAllFour() {
        val h = InstallationSigner.headersFor(
            "aa".repeat(32), "cHVi", "c2ln", 1795629969L,
        )
        assertEquals(4, h.size)
        assertEquals("aa".repeat(32), h["X-Inst-Key"])
        assertEquals("cHVi", h["X-Inst-Pub"])
        assertEquals("1795629969", h["X-Inst-Ts"])
        assertEquals("c2ln", h["X-Inst-Sig"])
    }

    // 真实派生链（§8.2 X-Inst-Key 口径）：JVM 生成 P-256 密钥对，public.encoded=
    // SPKI DER，指纹=SHA-256(DER)——sha256Hex 包装与独立 MessageDigest 双路径对拍
    // （防包装层实现漂移；格式锁 hex64）
    @Test
    fun fingerprintDerivesFromGeneratedKeyPair() {
        val gen = java.security.KeyPairGenerator.getInstance("EC")
        gen.initialize(java.security.spec.ECGenParameterSpec("secp256r1"))
        val spki = gen.generateKeyPair().public.encoded
        val viaWrapper = InstallationSigner.sha256Hex(spki)
        val viaDirect = java.security.MessageDigest.getInstance("SHA-256").digest(spki)
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
        assertEquals(64, viaWrapper.length)
        assertTrue(viaWrapper, viaWrapper.matches(Regex("[0-9a-f]{64}")))
        assertEquals(viaDirect, viaWrapper)
    }
}
