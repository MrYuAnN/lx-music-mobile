/*
 * 纯 Kotlin Ed25519 验签（RFC 8032，仅 verify）
 * 用途：规则包 manifest 与权益 receipt 的服务端签名校验，公钥由宿主经
 *       ActivationSdk.init(servicePubkeyHex=…) 注入（= 平台实例 secrets/service.public）。
 * 不引入依赖（BouncyCastle 版本随宿主不可控，ed25519 库需新增网络依赖），
 * BigInteger 实现；验签为低频调用（规则更新/激活），毫秒级足够。
 * 正确性由 RFC 8032 §7.1 官方测试向量单测保证（宿主侧 Ed25519VerifyTest）。
 */
package top.astock.activation

import java.math.BigInteger
import java.security.MessageDigest

object Ed25519Verify {

    private val P: BigInteger = BigInteger.TWO.pow(255).subtract(BigInteger.valueOf(19))
    private val L: BigInteger = BigInteger.TWO.pow(252)
        .add(BigInteger("27742317777372353535851937790883648493"))
    private val D: BigInteger =
        BigInteger("-121665").multiply(BigInteger("121666").modInverse(P)).mod(P)
    private val SQRT_M1: BigInteger =
        BigInteger.TWO.modPow(P.subtract(BigInteger.ONE).divide(BigInteger.valueOf(4)), P)

    /** 扩展齐次坐标 (X:Y:Z:T)，x = X/Z，y = Y/Z，T = XY/Z */
    private class Pt(val x: BigInteger, val y: BigInteger, val z: BigInteger, val t: BigInteger)

    private val IDENT = Pt(BigInteger.ZERO, BigInteger.ONE, BigInteger.ONE, BigInteger.ZERO)

    /** RFC 8032 §5.1 基点 B：y = 4/5（注意不是 Curve25519 的 u=9，那是蒙哥马利形态） */
    private val BASE: Pt = run {
        val bx = BigInteger("15112221349535400772501151409588531511454012693041857206046113283949847762202")
        val by = BigInteger("46316835694926478169428394003475163141307993866256225615783033603165251855960")
        Pt(bx, by, BigInteger.ONE, bx.multiply(by).mod(P))
    }

    fun verify(publicKey: ByteArray, message: ByteArray, signature: ByteArray): Boolean {
        if (publicKey.size != 32 || signature.size != 64) return false
        return try {
            val a = decodePoint(publicKey)
            val rBytes = signature.copyOfRange(0, 32)
            val r = decodePoint(rBytes)
            val s = leToBigInteger(signature.copyOfRange(32, 64))
            if (s >= L) return false
            val k = leToBigInteger(sha512(rBytes + publicKey + message)).mod(L)
            // [S]B == R + [k]A（与 Go crypto/ed25519 兼容的余因子无校验）
            val lhs = scalarMult(BASE, s)
            val rhs = add(r, scalarMult(a, k))
            pointEquals(lhs, rhs)
        } catch (_: Exception) {
            false
        }
    }

    /** Ed25519 域元素为小端编码，BigInteger 需先反转 */
    private fun leToBigInteger(b: ByteArray): BigInteger {
        val rev = b.copyOf()
        rev.reverse()
        return BigInteger(1, rev)
    }

    private fun sha512(b: ByteArray): ByteArray = MessageDigest.getInstance("SHA-512").digest(b)

    private fun decodePoint(b: ByteArray): Pt {
        val yBytes = b.copyOf()
        yBytes[31] = (yBytes[31].toInt() and 0x7F).toByte()
        val y = leToBigInteger(yBytes)
        if (y >= P) throw IllegalArgumentException("point y out of range")
        val x = recoverX(y, (b[31].toInt() and 0x80) != 0)
        return Pt(x, y, BigInteger.ONE, x.multiply(y).mod(P))
    }

    /** x^2 = (y^2-1)/(d*y^2+1)；按符号位选解（RFC 8032 §5.1.3 解码步骤 3-4） */
    private fun recoverX(y: BigInteger, sign: Boolean): BigInteger {
        val yy = y.multiply(y).mod(P)
        val u = yy.subtract(BigInteger.ONE).mod(P)
        val v = D.multiply(yy).add(BigInteger.ONE).mod(P)
        var x = u.multiply(v.modPow(BigInteger.valueOf(3), P))
            .multiply(
                u.multiply(v.modPow(BigInteger.valueOf(7), P))
                    .modPow(P.subtract(BigInteger.valueOf(5)).divide(BigInteger.valueOf(8)), P)
            )
            .mod(P)
        val vx2 = v.multiply(x).multiply(x).mod(P)
        x = when {
            vx2 == u -> x
            vx2 == u.negate().mod(P) -> x.multiply(SQRT_M1).mod(P)
            else -> throw IllegalArgumentException("point not on curve")
        }
        if (x.signum() == 0 && sign) throw IllegalArgumentException("invalid sign bit")
        if (x.testBit(0) != sign) x = P.subtract(x)
        return x
    }

    /** RFC 8032 §5.1.4 加法公式 */
    private fun add(p: Pt, q: Pt): Pt {
        val a = p.y.subtract(p.x).multiply(q.y.subtract(q.x)).mod(P)
        val b = p.y.add(p.x).multiply(q.y.add(q.x)).mod(P)
        val c = p.t.multiply(BigInteger.TWO).multiply(D).multiply(q.t).mod(P)
        val d = p.z.multiply(BigInteger.TWO).multiply(q.z).mod(P)
        val e = b.subtract(a)
        val f = d.subtract(c)
        val g = d.add(c)
        val h = b.add(a)
        return Pt(e.multiply(f).mod(P), g.multiply(h).mod(P), f.multiply(g).mod(P), e.multiply(h).mod(P))
    }

    private fun scalarMult(p: Pt, k: BigInteger): Pt {
        var acc = IDENT
        var addend = p
        var n = k
        while (n.signum() > 0) {
            if (n.testBit(0)) {
                acc = add(acc, addend)
            }
            addend = add(addend, addend)
            n = n.shiftRight(1)
        }
        return acc
    }

    private fun pointEquals(p: Pt, q: Pt): Boolean {
        // x1/z1 == x2/z2 && y1/z1 == y2/z2  <=>  交叉相乘比较
        return p.x.multiply(q.z).mod(P) == q.x.multiply(p.z).mod(P) &&
            p.y.multiply(q.z).mod(P) == q.y.multiply(p.z).mod(P)
    }

    private fun isOnCurve(p: Pt): Boolean {
        val x2 = p.x.multiply(p.x).mod(P)
        val y2 = p.y.multiply(p.y).mod(P)
        return y2.subtract(x2).mod(P) == BigInteger.ONE.add(D.multiply(x2).multiply(y2)).mod(P)
    }
}
