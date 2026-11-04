/*
 * v1.5 code-overlap 前置查询单测（⑥件②净屏侧适配，2026-11-03）：parseOverlapKeys
 * 纯函数锚——正常解析/空数组合法（=纯跨源/无在绑）/坏 JSON 与缺字段归 null（与
 * HTTP 失败同路回退粗触发）。HTTP 路径行为不属纯 JVM 可测面，由真机冒烟盖。
 */
package top.astock.activation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CodeOverlapParseTest {

    @Test
    fun testNormalParsing() {
        assertEquals(
            listOf("fanqie", "hongguo"),
            EntitlementManager.parseOverlapKeys("""{"overlap":["fanqie","hongguo"]}"""),
        )
        assertEquals(listOf("fanqie"), EntitlementManager.parseOverlapKeys("""{"overlap":["fanqie"]}"""))
    }

    // 空数组合法（服务端码不存在/纯跨源统一空 overlap，客户端据此跳过确认）
    @Test
    fun testEmptyArrayIsValid() {
        assertEquals(emptyList<String>(), EntitlementManager.parseOverlapKeys("""{"overlap":[]}"""))
    }

    // 坏 JSON / 缺 overlap 字段 → null（=查询失败信号，调用方保守回退粗触发确认框）
    @Test
    fun testBadJsonIsNull() {
        assertNull(EntitlementManager.parseOverlapKeys("not json"))
        assertNull(EntitlementManager.parseOverlapKeys(""))
    }

    @Test
    fun testMissingFieldIsNull() {
        assertNull(EntitlementManager.parseOverlapKeys("""{"ok":true}"""))
        assertNull(EntitlementManager.parseOverlapKeys("""{"error":"internal"}"""))
    }

    // 字段存在但为 JSON null → null（代码审查 S-1：null 字段语义与缺字段语义同路回退）
    @Test
    fun testNullFieldIsNull() {
        assertNull(EntitlementManager.parseOverlapKeys("""{"overlap":null}"""))
    }
}
