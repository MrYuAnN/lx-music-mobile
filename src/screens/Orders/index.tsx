// 订单中心（批3，方案 §四批3 v1.2；效果图 v2/v4 定稿）。五态徽章（D3 拍板）：待支付橙/
// 待发码灰转圈/已发码绿/已完成·已关闭灰，已关闭折叠「历史订单」分组；「已完成」=delivered
// 且该单码已全部在本地 keys 命中（服务端仅四态，客户端推断——审查 I8）。待支付卡=继续支付
// （同 token+同 skuIds 幂等重放取回闲鱼链接齐发响应，服务端同 token 返回原单契约）+取消
// （审查 I7，/api/order/cancel 现成）。一键激活复用 activateByCode 编排链（审查 S2：
// ensureAuth(true) 取链重建防「激活成功但取链仍旧 token」）；组合单多码=D4 弹层（「叠加
// 激活 N 张」主钮）后逐张 activate(code, true) 同 App 融合叠加。轮询=15-30s 挡位+AppState
// 后台暂停（优化师 S5；对齐 ExpiryBanner 可见性停表先例）。
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, ActivityIndicator, Animated, TouchableOpacity, View } from 'react-native'

import { AnimatedScrollView } from '@/components/common/AnimatedLists'
import ScreenHeader from '@/components/common/ScreenHeader'
import PageContent from '@/components/PageContent'
import Text, { FontFamilies } from '@/components/common/Text'
import { createStyle, toast, confirmDialog } from '@/utils/tools'
import { hapticSelection } from '@/utils/haptic'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { dateFormat } from '@/utils'
import {
  syncOrders,
  getLocalOrders,
  getCachedCatalog,
  describeBySkuIds,
  cancelOrder,
  createOrder,
  orderErrorKey,
  yuan,
  type OrderRecord,
  type SkusCatalog,
} from '@/core/shiyin/order'
import { activationModule, type KeyEntry } from '@/utils/nativeModules/activation'
import { ensureAuth } from '@/core/shiyin/auth'
import { pushCheckoutScreen } from '@/navigation/navigation'

const POLL_INTERVAL_MS = 20000

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const scrollY = useRef(new Animated.Value(0)).current

  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [actingNo, setActingNo] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollBusy = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current != null) clearInterval(timer.current)
    }
  }, [])

  const refresh = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    void syncOrders().then(list => {
      if (!mounted.current) return
      setOrders(list)
      setLoading(false)
      setFailed(false)
    }).catch(() => {
      if (!mounted.current) return
      setLoading(false)
      if (!silent) setFailed(true)
    })
  }, [])

  // 两段式（Q5-A，2026-11-02 拍板 SWR）：本地快照（syncOrders 本就回写 shiyinOrders）毫秒级
  // 渲染，随后 syncOrders 静默刷新原地更新；刷新失败静默保留快照（断网也能看单；快照无陈旧
  // 标注=已知接受项，复审架构席 S-4）。仅零快照才走 loading→sync→failed 现状链。陈旧 pending
  // 单「继续支付」由同 token 重放服务端返回原单实际状态兜底（幂等契约）
  useEffect(() => {
    void (async() => {
      const local = await getLocalOrders()
      if (!mounted.current) return
      if (local.length > 0) {
        setOrders(local)
        setLoading(false)
        void syncOrders().then(list => {
          if (mounted.current) setOrders(list)
        }).catch(() => {})
      } else {
        refresh()
      }
    })()
  }, [refresh])

  // 轮询：AppState active 才挂表（后台暂停，优化师 S5）；20s 挡；busy 只在 tick 内防重入
  // (批3代码审 I4/F：start 不再查 busy——后台快速往返后 syncOrders 在途会令 start 恒 return,
  // 轮询表永久挂不上）
  useEffect(() => {
    const start = () => {
      if (timer.current != null) return
      timer.current = setInterval(() => {
        if (pollBusy.current || AppState.currentState != 'active') return
        pollBusy.current = true
        void syncOrders().then(list => {
          pollBusy.current = false
          if (mounted.current) setOrders(list)
        }).catch(() => {
          pollBusy.current = false
        })
      }, POLL_INTERVAL_MS)
    }
    const stop = () => {
      if (timer.current != null) {
        clearInterval(timer.current)
        timer.current = null
      }
    }
    if (AppState.currentState == 'active') start()
    const sub = AppState.addEventListener('change', state => {
      if (state == 'active') {
        refresh(true)
        start()
      } else stop()
    })
    return () => {
      stop()
      sub.remove()
    }
  }, [refresh])

  // 商品名目录（七题回归反馈 2026-11-02）：desc_snapshot=服务端合成规格串与购买页运营名
  // 不同源——本地缓存目录按 skuIds 匹配回归购买页命名，miss 回退 desc（试用单/下架单）
  const [catalog, setCatalog] = useState<SkusCatalog | null>(null)
  useEffect(() => {
    void getCachedCatalog().then(cat => {
      if (mounted.current) setCatalog(cat)
    }).catch(() => {})
  }, [])

  // 五态映射（D3/审查 I8）：服务端四态+客户端「已完成」推断（delivered 且码全在本地 keys 命中）
  const [boundCodes, setBoundCodes] = useState<string[]>([])
  useEffect(() => {
    void activationModule.getKeys().then(keys => {
      if (!mounted.current) return
      setBoundCodes(keys.map(k => k.trim().toUpperCase()))
    }).catch(() => {})
  }, [orders])

  // 五态推断（2026-11-03 双源化：主源=服务端 code_agg 六桶派生——本地凭证会被
  // 融合链合法剪除（pruneOrphanedKeys），客户端推不出「已并入/从未激活/绑他机」；
  // 回退=批3 D3/I8 客户端推断（服务端未升级 v2 时 agg 缺省，部署窗口兼容）。
  // 六桶语义：assigned+rebind=可激活面，boundSelf+mergedSelf=本机已完成面，
  // boundOther=他机，expired=过期展示桶（含吊销/作废）。全零 agg=数据异常回落
  const nameOf = useCallback((o: OrderRecord): string => {
    return describeBySkuIds(catalog, o.skuIds) ?? o.desc
  }, [catalog])

  const statusOf = useCallback((o: OrderRecord): string => {
    if (o.status != 'delivered') return o.status
    const agg = o.codeAgg
    if (agg) {
      if (agg.assignedN + agg.rebindN > 0) return 'delivered'
      if (agg.boundSelfN + agg.mergedSelfN > 0) return 'completed'
      if (agg.boundOtherN > 0) return 'elsewhere'
      if (agg.expiredN > 0) return 'expired'
    }
    if (o.codes.length > 0 &&
      o.codes.every(c => boundCodes.includes(c.trim().toUpperCase()))) return 'completed'
    return 'delivered'
  }, [boundCodes])

  const { activeList, historyList } = useMemo(() => {
    const active: OrderRecord[] = []
    const history: OrderRecord[] = []
    for (const o of orders) {
      ;(statusOf(o) == 'closed' ? history : active).push(o)
    }
    return { activeList: active, historyList: history }
  }, [orders, statusOf])

  const handleCancel = useCallback((o: OrderRecord) => {
    hapticSelection()
    void confirmDialog({
      title: t('orders_cancel_confirm_title'),
      message: t('orders_cancel_confirm_msg'),
    }).then(confirmed => {
      if (!confirmed) return
      void cancelOrder(o.orderNo).then(ok => {
        if (ok) {
          toast(t('orders_cancel_done'))
          refresh(true)
        } else {
          toast(t('orders_cancel_failed'))
        }
      }).catch(() => { toast(t('orders_cancel_failed')) })
    }).catch(() => {})
  }, [t, refresh])

  // 继续支付（批3代码审 I3/A）：快照原 clientToken+同 skuIds 幂等重放（服务端同 token 返回
  // 原单）——跨进程（杀 App 重启）仍命中原单，token_conflict=原单已闭合轮换重建一次闭环；
  // 本地无 skuIds 的单（换机找回）不可重放，提示走客服
  const handleResumePay = useCallback((o: OrderRecord) => {
    hapticSelection()
    if (!o.skuIds || !o.clientToken) {
      toast(t('orders_resume_no_local'))
      return
    }
    void createOrder(o.skuIds, { clientToken: o.clientToken }).then(order => {
      if (!mounted.current) return
      pushCheckoutScreen(componentId, order)
    }).catch(err => {
      if (!mounted.current) return
      toast(t(orderErrorKey(err as Error)))
    })
  }, [componentId, t])

  // 一键激活（D4 拍板补齐，批3代码审 PM C-2：检测本地其它 delivered 单的未激活码——
  // 主钮=叠加激活全部（本单+跨单），次钮=仅激活本单；逐张 activate(code, true) 同 App
  // 融合叠加。部分失败（审查 I5）：任一张成功即 ensureAuth(true)+refresh（防「已激活但
  // 取链仍旧 token」复发），失败反馈 i18n 含进度。跨单码激活复用 rebindKey 同款直调
  // activate 语义（确认框已知情，不进 activateByCode 二次融合确认）。
  // 2026-11-03 口径同步（审查 IM-4）：own/extra 可激活判据由「码不在本地 keys」改
  // 「非本机在绑」——解绑码 receipt 保留本地（带停权标记 mark!=null），旧判据会把它
  // 误过滤成「均已激活」致按钮空转；getKeyEntries().mark==null=本机在绑（本地 SP 初值）
  const handleActivate = useCallback((o: OrderRecord) => {
    hapticSelection()
    if (!o.codes.length || actingNo != null) return
    setActingNo(o.orderNo)
    void (async() => {
      try {
        // 非本机在绑判定：mark!=null（unbound/bound_other）或不在码卡列表=可激活
        const entries = await activationModule.getKeyEntries().catch(() => [] as KeyEntry[])
        const activelyBound = new Set(entries.filter(e => e.mark == null).map(e => e.key.trim().toUpperCase()))
        const own = o.codes.map(c => c.trim()).filter(c => !activelyBound.has(c.toUpperCase()))
        const extra: string[] = []
        for (const other of orders) {
          if (other.orderNo == o.orderNo || other.status != 'delivered') continue
          for (const c of other.codes.map(x => x.trim())) {
            if (!activelyBound.has(c.toUpperCase()) && !own.includes(c) && !extra.includes(c)) extra.push(c)
          }
        }
        const n = own.length
        if (n == 0) {
          toast(t('orders_activate_already'))
          return
        }
        // D4 双钮两段式（confirmDialog 双钮限制）：有跨单码时主弹层=「叠加全部」，取消
        // 落到次弹层=「仅激活本单」，再取消=放弃；无跨单码时单弹层（本单 N 张）
        let list: string[]
        if (extra.length > 0) {
          const all = await confirmDialog({
            title: t('orders_activate_confirm_title'),
            message: t('orders_activate_confirm_stack', { n, extra: extra.length }),
            bgClose: false,
          }).catch(() => false)
          if (all) {
            list = [...own, ...extra]
          } else {
            const only = await confirmDialog({
              title: t('orders_activate_only_title'),
              message: t('orders_activate_only_msg', { n }),
              confirmButtonText: t('orders_activate_only_btn'),
              bgClose: false,
            }).catch(() => false)
            if (!only) return
            list = own
          }
        } else {
          const one = await confirmDialog({
            title: t('orders_activate_confirm_title'),
            message: n > 1 ? t('orders_activate_confirm_combo', { n }) : t('orders_activate_confirm_one'),
            bgClose: false,
          }).catch(() => false)
          if (!one) return
          list = own
        }
        let okCount = 0
        let lastErrMsg: string | null = null
        for (const code of list) {
          const r = await activationModule.activate(code, true)
          if (r.ok) okCount++
          else lastErrMsg = r.message
        }
        if (okCount > 0) {
          // 任一张成功即重建取链+刷新（审查 I5：防「已激活但取链仍旧 token」复发）
          void ensureAuth(true).catch(() => {})
          refresh(true)
        }
        if (lastErrMsg == null) toast(t('orders_activate_done'))
        else toast(t('orders_activate_partial', { ok: okCount, total: list.length, msg: lastErrMsg || t('activation_failed') }))
      } finally {
        if (mounted.current) setActingNo(null)
      }
    })()
  }, [actingNo, t, refresh, orders])

  const handleToggleHistory = useCallback(() => {
    hapticSelection()
    setShowHistory(prev => !prev)
  }, [])

  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])

  return (
    <PageContent>
      <View style={[styles.container, { paddingTop: headerTotal }]}>
        <AnimatedScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.pollHint}>
            <Text size={12} color={theme['c-font-label']}>{t('orders_poll_hint')}</Text>
          </View>
          {loading
            ? (
              <View style={styles.center}><Text size={13} color={theme['c-font-label']}>{t('purchase_loading')}</Text></View>
              )
            : failed
              ? (
                <View style={styles.center}><Text size={13} color={theme['c-font-label']}>{t('purchase_failed')}</Text></View>
                )
                : activeList.length == 0 && historyList.length == 0
                  ? (
                    <View style={styles.center}><Text size={13} color={theme['c-font-label']}>{t('orders_empty')}</Text></View>
                    )
                    : (
                      <>
                        {activeList.map(o => (
                          <OrderCard
                            key={o.orderNo || o.maskedNo}
                            order={o}
                            name={nameOf(o)}
                            status={statusOf(o)}
                            acting={actingNo == o.orderNo}
                            theme={theme}
                            t={t}
                            onResumePay={handleResumePay}
                            onCancel={handleCancel}
                            onActivate={handleActivate}
                          />
                        ))}
                        {historyList.length > 0 && (
                          <>
                            <TouchableOpacity style={styles.historyToggle} activeOpacity={0.7} onPress={handleToggleHistory}>
                              <Text size={13} color={theme['c-font-label']}>
                                {t('orders_history_toggle', { n: historyList.length })}
                              </Text>
                              <Text size={12} color={theme['c-font-label']}>{showHistory ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            {showHistory && historyList.map(o => (
                              <OrderCard
                                key={o.orderNo || o.maskedNo}
                                order={o}
                                name={nameOf(o)}
                                status={statusOf(o)}
                                acting={actingNo == o.orderNo}
                                theme={theme}
                                t={t}
                                onResumePay={handleResumePay}
                                onCancel={handleCancel}
                                onActivate={handleActivate}
                              />
                            ))}
                          </>
                        )}
                      </>
                    )}
          <View style={styles.tail} />
        </AnimatedScrollView>
      </View>
      <ScreenHeader componentId={componentId} title={t('orders_title')} progress={scrollY} />
    </PageContent>
  )
}

// 五态徽章配色（D3 拍板）：待支付橙/待发码灰+spinner/已发码绿/已关闭灰。
// 2026-11-03 生命周期派生回归反馈（装机走查「状态与其他文字同级不显眼」）：
// 语义色阶定稿（对标 App Store 订阅页「活跃」绿 pill 成功语义+HIG 语义色
// systemGreen 成功/systemBlue 信息/systemOrange 警示，印象级）——completed
// 灰→绿（终态成功，与 delivered 同族，原灰系语义倒挂）；elsewhere 灰→蓝
// （「在别处」信息语义）；expired 恒橙警示。徽章文字 11→12+Medium 字重
// （fontFamily 直引——CJK 禁 fontWeight 合成，Q3 踩坑单源），底 alpha 微升
const STATUS_VIEW: Record<string, { key: string, color: string, bgAlpha: number }> = {
  pending: { key: 'orders_status_pending', color: 'rgb(255,149,10)', bgAlpha: 0.15 },
  paid: { key: 'orders_status_paid', color: 'rgb(138,138,142)', bgAlpha: 0.12 },
  delivered: { key: 'orders_status_delivered', color: 'rgb(52,199,89)', bgAlpha: 0.14 },
  completed: { key: 'orders_status_completed', color: 'rgb(52,199,89)', bgAlpha: 0.15 },
  closed: { key: 'orders_status_closed', color: 'rgb(138,138,142)', bgAlpha: 0.12 },
  elsewhere: { key: 'orders_status_elsewhere', color: 'rgb(10,102,255)', bgAlpha: 0.12 },
  expired: { key: 'orders_status_expired', color: 'rgb(255,149,10)', bgAlpha: 0.15 },
}

const OrderCard = memo(({ order, name, status, acting, theme, t, onResumePay, onCancel, onActivate }: {
  order: OrderRecord
  name: string
  status: string
  acting: boolean
  theme: any
  t: (k: any, p?: any) => string
  onResumePay: (o: OrderRecord) => void
  onCancel: (o: OrderRecord) => void
  onActivate: (o: OrderRecord) => void
}) => {
  const view = STATUS_VIEW[status] ?? STATUS_VIEW.closed
  const bg = view.color.startsWith('rgb')
    ? view.color.replace('rgb(', 'rgba(').replace(')', `,${view.bgAlpha})`)
    : view.color
  const noText = order.orderNo || order.maskedNo
  return (
    <View style={[styles.card, { backgroundColor: theme['c-content-background'] }]}>
      <View style={styles.cardHead}>
        <Text size={12} color={theme['c-font-label']} style={styles.orderNo}>{noText}</Text>
        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
          <Text size={12} color={view.color} style={styles.statusBadgeText}>{t(view.key)}</Text>
          {/* 待发码转圈（D3/审查 I6：ActivityIndicator 替代静态圆环） */}
          {status == 'paid' && <ActivityIndicator size="small" color={view.color} />}
        </View>
      </View>
      <View style={styles.skuRow}>
        <Text size={15} style={styles.skuName}>{name}</Text>
        <Text size={16}>{`¥${yuan(order.amountCents)}`}</Text>
      </View>
      {/* 生命周期提示行（2026-11-03 派生）：可激活汇总（含跨桶混合）/已完成/
          他机/过期/uid 视图无码 actionable 输码引导——agg 缺省回退旧码数提示。
          非主导桶明细不静默（代码审 S5）：派生态在主文案后拼接其余非零桶 */}
      {(() => {
        let hint: string | null = null
        const agg = order.codeAgg
        if (status == 'delivered') {
          if (agg && order.codes.length == 0) {
            const actionable = agg.assignedN + agg.rebindN
            if (actionable > 0) {
              hint = t('orders_uid_actionable_hint', { n: actionable })
              const rest: string[] = []
              const done = agg.boundSelfN + agg.mergedSelfN
              if (done > 0) rest.push(t('orders_agg_done', { n: done }))
              if (agg.boundOtherN > 0) rest.push(t('orders_agg_other', { n: agg.boundOtherN }))
              if (agg.expiredN > 0) rest.push(t('orders_agg_expired', { n: agg.expiredN }))
              if (rest.length > 0) hint += ' · ' + rest.join(' · ')
            }
          } else if (agg) {
            const parts: string[] = []
            const actionable = agg.assignedN + agg.rebindN
            if (actionable > 0) parts.push(t('orders_agg_actionable', { n: actionable }))
            const done = agg.boundSelfN + agg.mergedSelfN
            if (done > 0) parts.push(t('orders_agg_done', { n: done }))
            if (agg.boundOtherN > 0) parts.push(t('orders_agg_other', { n: agg.boundOtherN }))
            if (agg.expiredN > 0) parts.push(t('orders_agg_expired', { n: agg.expiredN }))
            hint = parts.length > 0 ? parts.join(' · ') : null
          } else if (order.codes.length > 0) {
            hint = t('orders_codes_hint', { n: order.codes.length })
          }
        } else {
          // 派生态主文案 + 非主导桶明细（completed 只补他机/过期；elsewhere 补
          // 已完成/过期；expired 补已完成/他机——actionable 桶与四态互斥不出现）
          const base = status == 'completed' ? t('orders_completed_hint')
            : status == 'elsewhere' ? t('orders_elsewhere_hint')
              : status == 'expired' ? t('orders_expired_hint') : null
          if (base != null) {
            hint = base
            if (agg) {
              const done = agg.boundSelfN + agg.mergedSelfN
              const rest: string[] = []
              if (status != 'completed' && done > 0) rest.push(t('orders_agg_done', { n: done }))
              if (status != 'elsewhere' && agg.boundOtherN > 0) rest.push(t('orders_agg_other', { n: agg.boundOtherN }))
              if (status != 'expired' && agg.expiredN > 0) rest.push(t('orders_agg_expired', { n: agg.expiredN }))
              if (rest.length > 0) hint += ' · ' + rest.join(' · ')
            }
          }
        }
        return hint != null
          ? (
            <Text size={12} color={theme['c-font']} style={styles.codesHint}>{hint}</Text>
            )
          : null
      })()}
      <Text size={11} color={theme['c-font-label']} style={styles.timeText}>
        {order.createdAt > 0 ? dateFormat(order.createdAt * 1000, 'Y-M-D h:m') : ''}
      </Text>
      {status == 'pending' && (
        <View style={styles.ops}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme['c-primary'] }, acting && { opacity: 0.6 }]}
            activeOpacity={0.7}
            disabled={acting}
            onPress={() => { onResumePay(order) }}
          >
            <Text size={14} color={theme['c-on-primary']}>{t('orders_resume_pay')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ghostBtn, { borderColor: theme['c-border-background'] }]}
            activeOpacity={0.7}
            onPress={() => { onCancel(order) }}
          >
            <Text size={14} color={theme['c-font-label']}>{t('orders_cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {status == 'delivered' && order.codes.length > 0 && (
        <View style={styles.ops}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme['c-primary'] }, acting && { opacity: 0.6 }]}
            activeOpacity={0.7}
            disabled={acting}
            onPress={() => { onActivate(order) }}
          >
            <Text size={14} color={theme['c-on-primary']}>
              {order.codes.length > 1 ? t('orders_activate_combo', { n: order.codes.length }) : t('orders_activate_one')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.s28,
  },
  pollHint: {
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s10,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: SPACING.s16,
  },
  card: {
    borderRadius: 16,
    padding: SPACING.s16,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s10,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s8,
  },
  orderNo: {
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: SPACING.s10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusBadgeText: {
    fontFamily: FontFamilies.medium,
  },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s10,
  },
  skuName: {
    flex: 1,
  },
  codesHint: {
    marginTop: SPACING.s8,
  },
  timeText: {
    marginTop: SPACING.s8,
  },
  ops: {
    flexDirection: 'row',
    gap: SPACING.s10,
    marginTop: SPACING.s12,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: SPACING.s10,
  },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: SPACING.s8,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.s16,
    marginVertical: SPACING.s8,
    paddingHorizontal: SPACING.s4,
  },
  tail: {
    height: SPACING.s8,
  },
})
