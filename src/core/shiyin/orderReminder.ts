// 待支付订单提醒（批3 v1.2 拍板：2 次=建单后 6h 首提+40h 临关单前追提；48h 关单随批2
// 后端既定不动）。对标注记（审查 I3）：主流平台关单 24h/催付 1-2 次，拾音放宽到 48h 的
// 理由=闲鱼人工付款动线长（拍下→付款→回 App 核验），6h/40h 两提对齐业界「催付 1-2 次」
// 频次上限——本产品自定阈值。
// 触发挂载（审查 I4）：Home 常驻挂载+AppState active 双触发（pending 判定=本地快照零网络，
// 与 ExpiryBanner useActivationState 同「本地态即查」模式；确认提醒后才拉订单核实一次）。
// debug 加速口（方案拍板）：__DEV__ 构建窗口压缩为 90s/10min，供真机验证弹窗动线。
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { confirmDialog } from '@/utils/tools'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { getLocalOrders, syncOrders, type OrderRecord } from './order'
import { pushOrdersScreen } from '@/navigation/navigation'

const HOUR_MS = 3600_000
const REMIND_1_AFTER = 6 * HOUR_MS
const REMIND_1_UNTIL = REMIND_1_AFTER + 6 * HOUR_MS // 6~12h 窗口（错过不补弹）
const REMIND_2_AFTER = 40 * HOUR_MS
const REMIND_2_UNTIL = REMIND_2_AFTER + 2 * HOUR_MS // 40~42h（48h 关单前追提）
const CHECK_INTERVAL = 5 * 60_000 // 活跃期判定节流（本地零网络，纯省电语义）
// debug 加速（方案拍板 debug 验证口）：仅 __DEV__ 构建，窗口压缩到 90s/10min
const DEV = typeof __DEV__ != 'undefined' && __DEV__
const AFTER_1 = DEV ? 90_000 : REMIND_1_AFTER
const UNTIL_1 = DEV ? 10 * 60_000 : REMIND_1_UNTIL
const AFTER_2 = DEV ? 10 * 60_000 : REMIND_2_AFTER
const UNTIL_2 = DEV ? 20 * 60_000 : REMIND_2_UNTIL

type RemindedMap = Record<string, number>

const loadReminded = async(): Promise<RemindedMap> => {
  return (await getData<RemindedMap>(storageDataPrefix.shiyinOrderRemind)) ?? {}
}

/** 挑一条该提醒的单：pending 且 now-createdAt 落在未提醒过的提醒窗口内（多单取最早建单） */
const pickDue = (orders: OrderRecord[], reminded: RemindedMap): OrderRecord | null => {
  const now = Date.now()
  let pick: OrderRecord | null = null
  for (const o of orders) {
    if (o.status != 'pending' || !o.orderNo) continue
    const age = now - o.createdAt * 1000
    const due = (age >= AFTER_1 && age < UNTIL_1) || (age >= AFTER_2 && age < UNTIL_2)
    if (!due || reminded[o.orderNo] != null) continue
    if (pick == null || o.createdAt < pick.createdAt) pick = o
  }
  return pick
}

/** Home 常驻挂载（useOrderReminder）：挂载+AppState active 触发判定；命中弹确认框，
 *  确认=先拉一次订单核实（状态可能已变）再跳订单中心；取消=仍记已提醒（不再弹） */
export const useOrderReminder = (componentId: string): void => {
  const lastCheck = useRef(0)
  const checking = useRef(false)

  const check = async(force = false) => {
    if (checking.current) return
    if (!force && Date.now() - lastCheck.current < CHECK_INTERVAL) return
    checking.current = true
    lastCheck.current = Date.now()
    try {
      const [orders, remindedRaw] = await Promise.all([getLocalOrders(), loadReminded()])
      // 已提记录随订单闭环清理（审查 S5：关闭单的条目不再永留）
      const live = new Set(orders.map(o => o.orderNo))
      const reminded: RemindedMap = {}
      for (const [no, at] of Object.entries(remindedRaw)) {
        if (live.has(no)) reminded[no] = at
      }
      const due = pickDue(orders, reminded)
      if (due == null) return
      const confirmed = await confirmDialog({
        title: global.i18n.t('order_remind_title'),
        message: global.i18n.t('order_remind_msg', { desc: due.desc, amount: (due.amountCents / 100).toFixed(2) }),
        confirmButtonText: global.i18n.t('order_remind_go'),
        bgClose: true,
      }).catch(() => false)
      reminded[due.orderNo] = Math.floor(Date.now() / 1000)
      await saveData(storageDataPrefix.shiyinOrderRemind, reminded)
      if (confirmed) {
        // 核实一次（可能已 paid/delivered/closed），同步本地后再跳
        await syncOrders().catch(() => {})
        pushOrdersScreen(componentId)
      }
    } finally {
      checking.current = false
    }
  }

  useEffect(() => {
    void check()
    const sub = AppState.addEventListener('change', state => {
      if (state == 'active') void check()
    })
    return () => { sub.remove() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
