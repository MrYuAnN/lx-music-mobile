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
    /** 撤权离线宽限上限（天；2026-11-25 批 3 D-07，35 拍板「最大离线窗口 30 天」）：
     *  距最近一次服务端确认超过该天数 → 全部权益视为失效（防断网逃逸撤权）。
     *  0=不限（缺省，旧语义；shiyin 等宿主不传即不限，净屏壳传 30）。
     *  锚点=last_server_confirm（服务端任何结构化应答即刷新，max 单调），
     *  窗算术并入 effectiveNowSeconds seam（graceAwareNow）。 */
    val offlineGraceDays: Int = 0,
)
