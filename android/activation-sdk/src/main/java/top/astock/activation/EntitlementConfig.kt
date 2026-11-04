/*
 * T4 件5 权益判定配置（2026-11-04，方案 doc/plans/entitlement-semantics-single-source.md）：
 * 通用遮蔽机制配置——fallbackApp/产品键表由宿主经 ActivationSdk.init 注入，
 * 默认全空=遮蔽与键域语义关闭（净屏行为逐字节不变，R1 等价性设计）。
 *
 * 拾音注入值：fallbackApp="shiyin"（全源兜底键）、productApps=["shiyin","tx","wy","kg","kw"]
 * （五键表单源——原 RN activation.ts / ExpiryReminderWorker.kt 双源废止，F-03 红线消解）。
 * 净屏不注入（两字段 null）。
 */
package top.astock.activation

data class EntitlementConfig(
    /** 兜底键名（shiyin=全源码）：该键有效时其它单源键被「遮住」（不参与判定/展示/提醒） */
    val fallbackApp: String? = null,
    /** 产品键域清单（键域过滤/键表消费单源；null=不做键域过滤） */
    val productApps: List<String>? = null,
)
