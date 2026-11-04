// 拾音域错误族单源（A1 架构批，grilling Q3 定稿）：快速失败族构造器与名单收口一处。
// 原形态=auth.ts 本地构造器+名单单挂鉴权域、client.ts 另手搓同族构造（双处定义漂移风险）。
// 消费方=auth（注册链）/client（取链链）/gate（引导链）；快抛判据消费方=download.ts
// /core/music/utils.ts。纯 .ts 零依赖（node:test 可加载，gate.test.mts 名单断言依赖此性质）。
// 快速失败语义（R1，方案 self-hosted-music-server.md §四）：名单内错误不进退避循环，
// 换源链同 ShiyinRegisterFailed 待遇直接终止不空转退避。

// 域错误构造器（name 承载分类，isShiyinFastFail 按 name 识别；文案由调用方 i18n 注入）
export const shiyinError = (name: string, message: string): Error => {
  const err = new Error(message)
  err.name = name
  return err
}

/** 非退避错误（快速失败族）：ensureAuth 与换源链按 name 识别直接终止 */
export const isShiyinFastFail = (err: unknown): boolean => {
  const name = (err as Error)?.name ?? ''
  return (
    name == 'ShiyinRegisterFailed' || name == 'ShiyinNotActivated' ||
    name == 'ShiyinEntitlementExpired' || name == 'ShiyinEntitlementInvalid' ||
    name == 'ShiyinUpgradeRequired'
  )
}

// 配对工厂（A1 审查 S3）：name+文案 key 配对单源——name 漂移会静默跌出 isShiyinFastFail
// 名单（换源链从快抛变退避空转），key 漂移则文案错位；消费方=gate.ensurePlayable / client
// 403 分支（global.i18n.t 直传）。t 结构注入保持纯模块（node:test 可加载）；key 联合单源
// 此处，gate.GateI18nKey 引本类型扩展（tsc 交叉校验防漂移）
export type EntitlementErrorKey = 'shiyin_not_activated' | 'shiyin_entitlement_expired'

export const notActivatedError = (t: (key: EntitlementErrorKey) => string): Error =>
  shiyinError('ShiyinNotActivated', t('shiyin_not_activated'))

export const entitlementExpiredError = (t: (key: EntitlementErrorKey) => string): Error =>
  shiyinError('ShiyinEntitlementExpired', t('shiyin_entitlement_expired'))
