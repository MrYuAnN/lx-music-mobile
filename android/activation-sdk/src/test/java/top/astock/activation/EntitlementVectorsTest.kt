/*
 * T4 件3 语义向量现状基线（2026-11-04，方案 doc/plans/entitlement-semantics-single-source.md）：
 * validity/aggregate 段 JUnit 断言（纯 JVM，org.json 真实现，同 ClaimOrchestrationTest 形态）。
 * 向量单源=平台仓 sdk/android/tests/entitlement-vectors.json（语义权威侧），并排 checkout
 * 相对路径探测 + ENTITLEMENT_VECTORS_PATH 覆盖；不可达 → Assume skip（显眼输出；
 * 收尾检查=非 skip 态，沿净屏 drift 锁既有惯例 sdk_drift_test.go:18）。
 * 先导批=现状基线（EntitlementManager.validAt/anyActive 为 computeCurrent:375 /
 * isEntitled:383 现状谓词原样搬家，零行为变化）；收编批三层化后断言对象切换到
 * 纯函数层、向量内容不变（等价性证明——审查 I-A 时序拍板）。
 * masking/primary 段随收编批启用（方案件 3 分期）。
 */
package top.astock.activation

import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

class EntitlementVectorsTest {

    private fun loadVectors(): JSONObject? {
        val candidates = mutableListOf<File>()
        System.getenv("ENTITLEMENT_VECTORS_PATH")?.let { candidates.add(File(it)) }
        // workingDir 兜底探测：模块目录（activation-sdk）向上逐级找并排 checkout 的
        // license-platform（覆盖 gradle workingDir=模块/仓根两种布局）
        var dir: File? = File(System.getProperty("user.dir"))
        var hops = 0
        while (dir != null && hops < 6) {
            candidates.add(File(dir, "license-platform/sdk/android/tests/entitlement-vectors.json"))
            dir = dir.parentFile
            hops++
        }
        val hit = candidates.firstOrNull { it.isFile }
        if (hit == null) {
            println(
                "WARN [entitlement-vectors] SKIP：向量文件不可达 " +
                    "(ENTITLEMENT_VECTORS_PATH 未设且并排 checkout 未命中)；" +
                    "收尾检查要求本测试非 skip 态"
            )
            return null
        }
        return JSONObject(hit.readText(Charsets.UTF_8))
    }

    /** JSON 值 → Long：Number 直转；null/脏字符串 → Long.MIN_VALUE（非 0、恒过去 → 过期，对齐向量 A9/A12 fail-closed 口径） */
    private fun longOf(v: Any?): Long = when (v) {
        is Number -> v.toLong()
        else -> Long.MIN_VALUE
    }

    private fun section(root: JSONObject, name: String): org.json.JSONArray? {
        val arr = root.optJSONArray(name)
        if (arr == null) {
            println("WARN [entitlement-vectors] 段缺失（随分期启用）：$name")
        }
        return arr
    }

    @Test
    fun validityVectors() {
        val root = loadVectors() ?: run { assumeTrue("[entitlement-vectors] 向量文件不可达，skip", false); return }
        val arr = section(root, "validity") ?: return
        for (i in 0 until arr.length()) {
            val v = arr.getJSONObject(i)
            val got = EntitlementManager.validAt(longOf(v.opt("exp")), v.optLong("nowSec"))
            assertTrue(
                "${v.optString("id")}: exp=${v.opt("exp")} now=${v.optLong("nowSec")} got=$got",
                got == v.optBoolean("expectedValid"),
            )
        }
    }

    @Test
    fun aggregateVectors() {
        val root = loadVectors() ?: run { assumeTrue("[entitlement-vectors] 向量文件不可达，skip", false); return }
        val arr = section(root, "aggregate") ?: return
        for (i in 0 until arr.length()) {
            val v = arr.getJSONObject(i)
            // scope=py-fallback（appsExp 空回退 expTs）仅 pytest 消费——SDK 现状无回退
            // 语义（computeCurrent merged 空=Unactivated），跳过并留痕
            val appsJo = v.optJSONObject("appsExp")
            if (appsJo == null || appsJo.length() == 0) {
                println("SKIP [entitlement-vectors] ${v.optString("id")}（py-fallback 域，非 SDK 消费语义）")
                continue
            }
            val apps = HashMap<String, Long>()
            appsJo.keys().forEach { k -> apps[k] = longOf(appsJo.opt(k)) }
            val got = EntitlementManager.anyActive(apps, v.optLong("nowSec"))
            assertTrue(
                "${v.optString("id")}: apps=$apps now=${v.optLong("nowSec")} got=$got",
                got == v.optBoolean("expectedAnyActive"),
            )
        }
    }
}
