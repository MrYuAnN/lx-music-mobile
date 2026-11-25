// Canonical.kt 跨端口径投影（生成文件，勿手改——ordercore/internal/canonical/gen
// go:generate 产出，freshness 锁=order-core canonical_test.go 非 gradle 文本比对。
// 改值须改 canonical.go 后重新生成三端；Kotlin 无本地编译，接线随装机冒烟。）
package top.astock.activation

object Canonical {
    const val TZ_BUSINESS = "Asia/Shanghai"
    const val VERSION_POLICY = "dot-split / atoi-or-zero / missing-zero / numeric-asc"
    val ORDER_STATUSES = listOf("pending", "paid", "delivered", "closed", "refunded")
    val ACTIVATE_ERROR_CODES = listOf("invalid_key", "revoked", "already_permanent", "expired", "not_bound", "device_mismatch", "device_limit", "trial_used", "invalid_product", "invalid_code", "key_not_found", "release_limit", "trial_no_release")
    val GATE_403_FAMILY = listOf("expired", "device_limit", "not_entitled_for_source", "source_disabled", "forbidden")
    val APP_LOCAL_CODES = listOf("device_bound_other", "local_recharge_needs_jp", "already_activated_local")
}
