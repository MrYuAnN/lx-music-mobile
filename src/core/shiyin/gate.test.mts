// entitlementGate 单测（A1 架构批，2026-11-04；运行：node --test src/core/shiyin/gate.test.mts）
// 纯工厂 + fake deps（keyDisplay.test.mts 同款 node:test 先例）：守卫布尔「存续期互斥/
// 结算即复位」时序、三出口分流、unactivated 快抛不引导不对称、per-source 预判边界、
// errors 快抛名单——原 client.ts 寄生时代只能真机回归兜底的高危区全部落测试位。
// 审查修复批（2026-11-05）：查态计数器锁 I-1（not_entitled 零查态）/S6（ensurePlayable
// 单查询）/S7（st=null 兜底）；errors 配对工厂 key 钉死
import test from 'node:test'
import assert from 'node:assert/strict'
import { createEntitlementGate } from './gate.ts'
import { isShiyinFastFail, shiyinError, notActivatedError, entitlementExpiredError } from './errors.ts'
import type { GateState } from './gate.ts'

// 态样例工厂（Partial 覆盖；state 域=unactivated/active/expired）
const st = (over: Partial<GateState> = {}): GateState => ({
  state: 'active',
  isTrial: false,
  expiries: null,
  ...over,
})

type ConfirmMode = 'ok' | 'cancel' | 'pending' | 'reject'

// 引导假体：confirm 首参 title 原样入 record（文案断言用）；mode 控制结算行为；
// stateQueries 记 getState 调用次数（I-1/S6 查询面锁定）
const makeGate = (state: GateState | null = st(), mode: ConfirmMode = 'ok') => {
  const calls = { confirm: [] as string[], pushMyKeys: 0, pushPurchase: 0, stateQueries: 0, tKeys: [] as string[] }
  let settle: ((v: boolean) => void) | null = null
  const gate = createEntitlementGate({
    getState: async() => {
      calls.stateQueries++
      return state
    },
    confirm: options => {
      calls.confirm.push(options.title)
      switch (mode) {
        case 'pending':
          return new Promise<boolean>(resolve => { settle = resolve })
        case 'reject':
          return Promise.reject(new Error('dialog crashed'))
        default:
          return Promise.resolve(mode == 'ok')
      }
    },
    pushMyKeys: () => { calls.pushMyKeys++ },
    pushPurchase: () => { calls.pushPurchase++ },
    t: (key, val) => {
      calls.tKeys.push(key)
      return val == null ? key : `${key}|${JSON.stringify(val)}`
    },
  })
  return { gate, calls, settle: (v: boolean) => settle?.(v) }
}

// 弹窗 .then/.catch 挂微任务链，setImmediate 一跳全 flush
const flush = () => new Promise<void>(resolve => setImmediate(resolve))

test('入口闸三态分流：unactivated/expired 引导并返 blocked，active 放行零副作用', async() => {
  const un = makeGate(st({ state: 'unactivated' }))
  assert.equal(await un.gate.guardEntitlementGate(), true)
  assert.equal(un.calls.confirm[0], 'shiyin_unactivated_guide_title')
  await flush()
  assert.equal(un.calls.pushPurchase, 1)
  assert.equal(un.calls.pushMyKeys, 0)

  const trial = makeGate(st({ state: 'expired', isTrial: true }))
  assert.equal(await trial.gate.guardEntitlementGate(), true)
  assert.equal(trial.calls.confirm[0], 'shiyin_trial_expired_guide_title')

  const paid = makeGate(st({ state: 'expired' }))
  assert.equal(await paid.gate.guardEntitlementGate(), true)
  assert.equal(paid.calls.confirm[0], 'shiyin_expired_guide_title')
  await flush()
  assert.equal(paid.calls.pushMyKeys, 1) // 确认→去激活码页

  const active = makeGate(st())
  assert.equal(await active.gate.guardEntitlementGate(), false)
  assert.equal(active.calls.confirm.length, 0)
})

test('守卫布尔：弹窗存续期重复触发只弹一次；confirm 结算（取消/崩溃）即复位', async() => {
  const { gate, calls, settle } = makeGate(st({ state: 'expired' }), 'pending')
  assert.equal(await gate.guardEntitlementGate(), true)
  assert.equal(await gate.guardEntitlementGate(), true) // 弹窗在屏：再触发不重弹
  assert.equal(calls.confirm.length, 1)

  settle(false) // 用户取消
  await flush()
  assert.equal(await gate.guardEntitlementGate(), true)
  assert.equal(calls.confirm.length, 2) // 结算即复位：下次播放会再弹（锁播放语义）

  const crash = makeGate(st({ state: 'expired' }), 'reject')
  await crash.gate.guardEntitlementGate()
  await flush()
  await crash.gate.guardEntitlementGate()
  assert.equal(crash.calls.confirm.length, 2) // confirm 崩溃同样复位不卡死
})

test('互斥域：expired 族（笼统+per-source）共用守卫；unactivated 布尔独立', async() => {
  const { gate, calls } = makeGate(st({ state: 'expired' }), 'pending')
  await gate.guardEntitlementGate() // expired 引导在屏
  await gate.handleSourceRejected('tx', 'expired')
  assert.equal(calls.confirm.length, 1) // per-source 被权益互斥挡下

  const un = makeGate(st({ state: 'unactivated' }), 'pending')
  await un.gate.guardEntitlementGate() // unactivated 引导在屏
  await un.gate.handleSourceRejected('tx', 'not_entitled')
  assert.equal(un.calls.confirm.length, 2) // 未激活守卫不挡权益类引导（布尔独立）
})

test('取链前置 ensurePlayable：unactivated 快抛不引导；expired 引导+快抛；active/无态放行', async() => {
  const un = makeGate(st({ state: 'unactivated' }))
  await assert.rejects(() => un.gate.ensurePlayable(), (err: Error) => {
    assert.equal(err.name, 'ShiyinNotActivated')
    assert.ok(isShiyinFastFail(err))
    return true
  })
  assert.equal(un.calls.confirm.length, 0) // 快抛不引导（与入口闸有意不同）
  assert.equal(un.calls.stateQueries, 1) // 审查 S6：单查询

  const ex = makeGate(st({ state: 'expired' }))
  await assert.rejects(() => ex.gate.ensurePlayable(), (err: Error) => {
    assert.equal(err.name, 'ShiyinEntitlementExpired')
    assert.ok(isShiyinFastFail(err))
    return true
  })
  assert.equal(ex.calls.confirm.length, 1) // expired 先引导再快抛
  assert.equal(ex.calls.stateQueries, 1) // 审查 S6：单查询（原双查询形态退役）

  const ok = makeGate(st())
  await ok.gate.ensurePlayable()
  const none = makeGate(null) // 态查询失败（组合根回落 null）=放行
  await none.gate.ensurePlayable()
})

test('handleSourceRejected expired：per-source 预判（他源/兜底键在期→精准；矛盾态/无记录/在期/永久→笼统）', async() => {
  const per = makeGate(st({ expiries: { tx: 100 }, valid: { tx: false, wy: true } }))
  await per.gate.handleSourceRejected('tx', 'expired')
  assert.equal(per.calls.confirm[0], 'shiyin_source_expired_guide_title|{"name":"QQ音乐"}')
  await flush()
  assert.equal(per.calls.pushMyKeys, 1) // 确认→去激活码页

  const mask = makeGate(st({ expiries: { tx: 100 }, valid: { tx: false, shiyin: true } }))
  await mask.gate.handleSourceRejected('tx', 'expired') // 兜底键遮蔽视图=per-source 精准
  assert.equal(mask.calls.confirm[0], 'shiyin_source_expired_guide_title|{"name":"QQ音乐"}')

  const expectGeneric = async(name: string, over: Partial<GateState>) => {
    const g = makeGate(st(over))
    await g.gate.handleSourceRejected('tx', 'expired')
    assert.equal(g.calls.confirm[0], 'shiyin_expired_guide_title', name)
  }
  await expectGeneric('矛盾态 valid 缺失', { expiries: { tx: 100 }, valid: null })
  await expectGeneric('无该源记录', { expiries: { wy: 100 }, valid: { wy: false, kg: true } })
  await expectGeneric('该源在期', { expiries: { tx: 9999999999 }, valid: { tx: true, wy: true } })
  await expectGeneric('该源永久 0', { expiries: { tx: 0 }, valid: { tx: false, wy: true } })

  const none = makeGate(null)
  await none.gate.handleSourceRejected('tx', 'expired') // 审查 S7：st=null（组合根兜底态）→笼统
  assert.equal(none.calls.confirm[0], 'shiyin_expired_guide_title')
})

test('handleSourceRejected not_entitled：直达购买页引导，且零查态（审查 I-1）', async() => {
  const { gate, calls } = makeGate(st({ expiries: { tx: 100 }, valid: { tx: false, wy: true } }))
  await gate.handleSourceRejected('tx', 'not_entitled')
  assert.equal(calls.confirm[0], 'shiyin_source_not_entitled_title|{"name":"QQ音乐"}')
  assert.equal(calls.stateQueries, 0) // I-1：原实现零查态，逐字等价（不预判不查 isTrial）
  await flush()
  assert.equal(calls.pushPurchase, 1)
  assert.equal(calls.pushMyKeys, 0)
})

test('errors：快抛名单五 name 全命中；配对工厂 name+key 单源钉死（审查 S3）', () => {
  for (const name of ['ShiyinRegisterFailed', 'ShiyinNotActivated', 'ShiyinEntitlementExpired', 'ShiyinEntitlementInvalid', 'ShiyinUpgradeRequired']) {
    assert.ok(isShiyinFastFail(shiyinError(name, 'x')), name)
  }
  assert.equal(isShiyinFastFail(shiyinError('SomeOtherError', 'x')), false)
  assert.equal(isShiyinFastFail(new Error('plain')), false)
  assert.equal(isShiyinFastFail(null), false)

  const keys: string[] = []
  const fakeT = (key: string) => { keys.push(key); return `msg:${key}` }
  const expired = entitlementExpiredError(fakeT)
  assert.equal(expired.name, 'ShiyinEntitlementExpired')
  assert.equal(expired.message, 'msg:shiyin_entitlement_expired')
  const notActivated = notActivatedError(fakeT)
  assert.equal(notActivated.name, 'ShiyinNotActivated')
  assert.equal(notActivated.message, 'msg:shiyin_not_activated')
  assert.deepEqual(keys, ['shiyin_entitlement_expired', 'shiyin_not_activated'])
})
