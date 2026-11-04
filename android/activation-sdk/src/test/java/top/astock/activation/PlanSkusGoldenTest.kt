/*
 * T3 笔③ 解析器对拍路·SDK 侧（方案 App 仓 doc/plans/t3-contract-single-source.md）：
 * 净屏轻服务 /api/skus 宿主 payload golden（order-core server/jingping/api/testdata/
 * skus-payload-jingping.json）→ PlanSkus.parseSkuList 逐字段断言（解析面全键+meta
 * 副作用态）。golden 探测沿 EntitlementVectorsTest 形态：env SKUS_PAYLOAD_GOLDEN_PATH
 * 覆盖 + user.dir 逐级上探并排 checkout；不可达 → 显眼 WARN 后 return（skip；
 * 收尾检查=非 skip 态，sdk_drift_test.go 既有纪律）。
 */
package top.astock.activation

import org.json.JSONObject
import org.junit.Test
import java.io.File

class PlanSkusGoldenTest {

    /** golden sample 节点（宿主 payload 响应体形态）——非整份 golden（外层含 contract/keys 包装） */
    private fun loadGoldenSample(): String? {
        System.getenv("SKUS_PAYLOAD_GOLDEN_PATH")?.let {
            return JSONObject(File(it).readText(Charsets.UTF_8)).getJSONObject("sample").toString()
        }
        var dir: File? = File(System.getProperty("user.dir"))
        var hops = 0
        while (dir != null && hops < 6) {
            val f = File(dir, "order-core/server/jingping/api/testdata/skus-payload-jingping.json")
            if (f.isFile) {
                return JSONObject(f.readText(Charsets.UTF_8)).getJSONObject("sample").toString()
            }
            dir = dir.parentFile
            hops++
        }
        println(
            "WARN [skus-payload-golden] SKIP：golden 不可达 " +
                "(SKUS_PAYLOAD_GOLDEN_PATH 未设且并排 checkout 未命中)；收尾检查要求本测试非 skip 态"
        )
        return null
    }

    @Test
    fun parseGoldenContract() {
        val raw = loadGoldenSample() ?: return
        val skus = PlanSkus.parseSkuList(raw)
        check(skus.size == 1) { "golden 条目数=${skus.size}" }
        val s = skus[0]
        // 条目 7 字段（camelCase 映射面）
        check(s.id == "fanqie-d7") { "id=${s.id}" }
        check(s.name == "番茄·7天") { "name=${s.name}" }
        check(s.apps == listOf("fanqie")) { "apps=${s.apps}" }
        check(s.tier == "d7") { "tier=${s.tier}" }
        check(s.days == 7) { "days=${s.days}" }
        check(s.deviceLimit == 1) { "deviceLimit=${s.deviceLimit}" }
        check(s.priceCents == 1290) { "priceCents=${s.priceCents}" }
        check(!s.isForever) { "days=7 非永久" }
        // meta 8 键副作用态（payable 恒 true——旧版 App 1.1.0 读 false 拦购买入口）
        check(PlanSkus.payable) { "payable=${PlanSkus.payable}" }
        check(PlanSkus.payMode == "manual") { "payMode=${PlanSkus.payMode}" }
        check(PlanSkus.nativeCheckout) { "nativeCheckout=${PlanSkus.nativeCheckout}" }
        check(PlanSkus.xianyuUrl == "https://m.tb.cn/x") { "xianyuUrl=${PlanSkus.xianyuUrl}" }
        check(PlanSkus.xianyuItemId == "1079871862279") { "xianyuItemId=${PlanSkus.xianyuItemId}" }
        check(PlanSkus.contactUrl == "https://afs.example") { "contactUrl=${PlanSkus.contactUrl}" }
        check(PlanSkus.serviceHours == "每日 12:00-23:00") { "serviceHours=${PlanSkus.serviceHours}" }
        check(PlanSkus.comboRates == listOf(2 to 900)) { "comboRates=${PlanSkus.comboRates}" }
    }
}
