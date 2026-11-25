/*
 * InstallationSigner 安装实例签名助手（同机判定实体化方案 v1 §8，2026-11-26）：
 * 硬件密钥库 EC P-256 私钥（别名 astock.install.proof.v1，不可导出、不绑锁屏
 * 凭据），对带身份的请求要点签名，四个 X-Inst-* 头随请求上行（§8.2）。
 *
 * 分层：
 *   - 纯函数层（canonical/sha256Hex/nextTs/headersFor）JVM 可测——规范化串逐字节
 *     与服务端验签对拍（§15）；
 *   - 密钥库层（sign/signForBody/keyEntry）Android only，**任何异常吞掉、返回空
 *     map=请求不带签名头**（§8.4：验签问题永不导致请求被拒，服务端按无证明回落
 *     实体规则并留痕 inst-proof-fail）。
 *
 * 签名内容（§8.2，\n 连接）：ts + device_id + device_name + drm_id + METHOD +
 * path + sha256hex(body)；GET 的 body 为空串；path 不含查询串。
 * 时间戳单调：max(当前秒, 本地上次值+1)（SharedPreferences 落盘；方案 §8.4——
 * 服务端不要求递增，单调仅为良好实践）。minSdk 23：Base64 用 android.util
 * （java.util.Base64 需 API 26）。
 */
package top.astock.activation

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import org.json.JSONObject
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec

object InstallationSigner {

    private const val TAG = "InstallSigner"
    const val ALIAS = "astock.install.proof.v1"
    private const val TS_PREFS = "astock.install.proof"
    private const val TS_KEY = "last_ts"

    // ---------- 纯函数层（JVM 可测；不触 Android Framework） ----------

    /** 规范化串（§8.2）：签名/验签双方唯一对拍锚。 */
    fun canonical(
        ts: Long,
        deviceId: String,
        deviceName: String,
        drmId: String,
        method: String,
        path: String,
        bodySha256Hex: String,
    ): String = "$ts\n$deviceId\n$deviceName\n$drmId\n$method\n$path\n$bodySha256Hex"

    fun sha256Hex(data: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(data)
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }

    /** 单调时间戳（§8.4）：max(当前秒, 上次+1)。 */
    fun nextTs(nowSec: Long, lastSec: Long): Long = maxOf(nowSec, lastSec + 1)

    /** 四个 X-Inst-* 头（§8.2）：指纹=SHA-256(SPKI DER) hex64、公钥=SPKI DER b64、
     *  签名=DER b64（AndroidKeyStore ECDSA 经 Signature 输出即 DER）。
     *  Base64 用 android.util（minSdk 23；java.util.Base64 需 26）——Android 薄壳
     *  与纯函数层拆开：JVM 单测走下方字符串重载（android.util 在 JVM 不可 mock）。 */
    fun headersFor(pubSpkiDer: ByteArray, sigDer: ByteArray, ts: Long): Map<String, String> =
        headersFor(
            sha256Hex(pubSpkiDer),
            Base64.encodeToString(pubSpkiDer, Base64.NO_WRAP),
            Base64.encodeToString(sigDer, Base64.NO_WRAP),
            ts,
        )

    /** 纯函数重载（JVM 可测）：编码后的指纹/公钥/签名直接装配四头。 */
    fun headersFor(pubKeyHex: String, pubB64: String, sigB64: String, ts: Long): Map<String, String> = mapOf(
        "X-Inst-Key" to pubKeyHex,
        "X-Inst-Pub" to pubB64,
        "X-Inst-Ts" to ts.toString(),
        "X-Inst-Sig" to sigB64,
    )

    // ---------- 密钥库层（Android；失败=不带签名头，永不拒请求） ----------

    /**
     * 对单次请求签名，返回四头（调用方逐头 setRequestProperty）；空 map=本次不带
     * 签名头（密钥库任何异常，§8.4）。bodyBytes=null 表示 GET（body 按空串哈希）。
     * 每次调用各产生新时间戳（§8.4：备域重放/超时重发拿到新值）。
     *
     * @Synchronized 全程串行（审查 I-A 2026-11-26）：keyEntry 的 check-then-generate
     * 若并发，AndroidKeyStore 同别名重复 generate 是静默覆盖——TOFU 首见钉定下
     * 败者钥先登记者指纹恒错位，该安装实例证明面永久失效；签名毫秒级低频，锁无代价。
     */
    @Synchronized
    fun sign(
        context: Context,
        deviceId: String,
        deviceName: String,
        drmId: String,
        method: String,
        path: String,
        bodyBytes: ByteArray?,
    ): Map<String, String> = try {
        val entry = keyEntry()
        val ts = monotonicTs(context)
        val data = canonical(
            ts, deviceId, deviceName, drmId, method, path,
            sha256Hex(bodyBytes ?: ByteArray(0)),
        ).toByteArray(Charsets.UTF_8)
        val sig = Signature.getInstance("SHA256withECDSA").apply {
            initSign(entry.privateKey)
            update(data)
        }.sign()
        headersFor(entry.certificate.publicKey.encoded, sig, ts)
    } catch (e: Exception) {
        // 三参保留异常类别（审查 S-2：低存储/竞态/算法定义缺失靠类别区分，§8.5 排障依赖）
        Log.w(TAG, "install signer unavailable, request goes unsigned", e)
        emptyMap()
    }

    /**
     * POST 出口便捷入口：三元组与 body 同源自请求体（bodyWithIdentity 产物恒含
     * 三键——device_name 空串也带键，DeviceIdentityWireTest 锁面），签名字节与
     * 调用方写出的字节逐位一致（同一 JSONObject.toString 确定性）。
     */
    fun signForBody(context: Context, body: JSONObject, method: String, path: String): Map<String, String> =
        sign(
            context,
            body.optString("device_id"),
            body.optString("device_name"),
            body.optString("drm_id"),
            method, path,
            body.toString().toByteArray(Charsets.UTF_8),
        )

    private fun keyEntry(): KeyStore.PrivateKeyEntry {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getEntry(ALIAS, null) as? KeyStore.PrivateKeyEntry)?.let { return it }
        val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        gen.initialize(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                // 不绑锁屏凭据（§8.4）：录入生物识别/改密码不失效
                .setUserAuthenticationRequired(false)
                .build(),
        )
        gen.generateKeyPair()
        return ks.getEntry(ALIAS, null) as KeyStore.PrivateKeyEntry
    }

    // sign() 已 @Synchronized——ts 读改写天然串行（审查 S-6：无并发重复形态）；
    // 系统时钟被前拨后回调时 last_ts 保持高位，证明面暂时失效至真实时间追上
    // （§8.5 第 4 项实机验证范围，方案 §8.4 公式拍板不动）
    private fun monotonicTs(context: Context): Long {
        val prefs = context.getSharedPreferences(TS_PREFS, Context.MODE_PRIVATE)
        val ts = nextTs(System.currentTimeMillis() / 1000, prefs.getLong(TS_KEY, 0L))
        prefs.edit().putLong(TS_KEY, ts).apply()
        return ts
    }
}
