// 支付引导页（批3，方案 §四批3 v1.2；效果图 v2 定稿）。数据=建单响应齐发（免二次拉取）：
// 金额 hero → 闲鱼唤端主钮（xianyu_item_id 非空=fleamarket:// 直拉商品页，降级=xianyu_url
// 原链；审查先例=PlanSkus.xianyuItemId 同语义）→ 三步引导 → 订单号复制（闲鱼留言核验）→
// 客服行（contact_url 空回退 faq，优化师 S6）→「挂载即自动核验轮询」（2026-11-03 拍板
// 对齐净屏自动刷新，推翻 D2 手动直按；「我已付款」按钮降级为手动立即触发）。
// 轮询策略（优化师 S5）：8s 密集、paid/delivered 即停、上限 40 次≈5min 后引导去订单中心、
// 卸载清理。核验语义（优化师 S4）=发起核验查询而非确认收款——「待管理员核验」反馈防重复操作误解。
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, AppState, Linking, TouchableOpacity, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'

import { AnimatedScrollView } from '@/components/common/AnimatedLists'
import ScreenHeader from '@/components/common/ScreenHeader'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import { createStyle, openUrl, toast } from '@/utils/tools'
import { hapticSelection } from '@/utils/haptic'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { SCREEN_HEADER_HEIGHT, SUCCESS_GREEN } from '@/config/constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { SHIYIN_BASE_URL } from '@/core/shiyin/config'
import { trackXianyuClick } from '@/core/shiyin/xianyuTrack'
import { fetchOrder, yuan, type CreateOrderResult, type OrderRecord } from '@/core/shiyin/order'
import { pushScreen } from '@/navigation/navigation'
import { ORDERS_SCREEN } from '@/navigation/screenNames'

// 轮询（批3代码审 I-2）：8s 起步、失败倍增封顶 30s（对标 config.ts 退避先例）、成功复位；
// 上限 40 次≈5min 后引导订单中心；AppState 退后台暂停、回前台续跑；closed 即停+反馈。
// 已知边界：在途请求不 cancelHttp（15s 超时自灭，mounted 守卫丢弃结果）——真取消需
// order.ts 暴露 cancelHttp 句柄，列为后续小改。
const POLL_BASE_MS = 8000
const POLL_MAX_DELAY_MS = 30000
const POLL_MAX_TIMES = 40

export default ({ componentId, order, names }: { componentId: string, order: CreateOrderResult, names?: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const scrollY = useRef(new Animated.Value(0)).current

  // 轮询态：polling=核验进行中；delivered=已发码（终态停止）
  const [polling, setPolling] = useState(false)
  const [delivered, setDelivered] = useState(order.status == 'delivered')
  const mounted = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const times = useRef(0)
  const delay = useRef(POLL_BASE_MS)
  const tickRef = useRef<() => void>(() => {})

  const clearTimer = () => {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimer()
    }
  }, [])

  const stopPolling = useCallback((hit: OrderRecord) => {
    clearTimer()
    setPolling(false)
    if (hit.status == 'delivered' && hit.codes.length) {
      setDelivered(true)
      toast(t('checkout_toast_delivered'))
    } else if (hit.status == 'closed') {
      // closed 反馈（审查 S-3：此前静默停表无解释，按钮恢复可点再点又空转）
      toast(t('checkout_order_closed'))
    }
  }, [t])

  // 核验轮询（2026-11-03 拍板推翻 D2 手动直按，对齐净屏自动刷新）：挂载即自动密集轮询
  // /api/orders?nos= 直到 delivered/closed；「我已付款」按钮降级为手动立即触发（超时/失败
  // 停表后可再按）。语义=发起核验查询（人工链路 App 无法确认已付——「待管理员核验」反馈
  // 防误当确认收款）
  const startPolling = useCallback(() => {
    if (polling || delivered) return
    setPolling(true)
    times.current = 0
    delay.current = POLL_BASE_MS
    const tick = () => {
      times.current++
      if (times.current > POLL_MAX_TIMES) {
        clearTimer()
        setPolling(false)
        toast(t('checkout_poll_timeout'))
        return
      }
      void fetchOrder(order.orderNo).then(hit => {
        if (!mounted.current) return
        delay.current = POLL_BASE_MS // 成功复位
        if (hit != null && (hit.status == 'delivered' || hit.status == 'closed')) stopPolling(hit)
        else timer.current = setTimeout(() => { tickRef.current() }, delay.current)
      }).catch(() => {
        if (!mounted.current) return
        // 失败退避（审查 I-2）：倍增封顶 30s
        delay.current = Math.min(delay.current * 2, POLL_MAX_DELAY_MS)
        timer.current = setTimeout(() => { tickRef.current() }, delay.current)
      })
    }
    tickRef.current = tick
    tick()
  }, [polling, delivered, order.orderNo, t, stopPolling])

  const handlePaid = useCallback(() => {
    if (polling || delivered) return
    hapticSelection()
    startPolling()
  }, [polling, delivered, startPolling])

  // 挂载即自动核验（对齐净屏自动刷新；pending 单进页即开始，delivered 初值已发码不轮询）
  useEffect(() => {
    if (!delivered) startPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // AppState 退后台暂停轮询、回前台续跑（审查 S2：与 Orders 页对齐，退屏不空转）
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (!mounted.current) return
      if (state == 'background') clearTimer()
      else if (state == 'active' && polling && delivered != true && times.current <= POLL_MAX_TIMES) {
        // F-16：先清在途 timer 再排新——后台返回时在途请求回调仍可能已排 timer，直接覆盖
        // 引用会漏 clear，双 timer 并行致轮询翻倍、40 次上限提前触顶（Orders 页幂等守卫同款）
        clearTimer()
        timer.current = setTimeout(() => { tickRef.current() }, delay.current)
      }
    })
    return () => { sub.remove() }
  }, [polling, delivered])

  const handleOpenXianyu = useCallback(() => {
    hapticSelection()
    if (order.xianyuItemId) {
      // 唤端失败（未装闲鱼）降级原链（PlanSkus.xianyuItemId 同语义）。
      // F-09 归因埋点（fire-and-forget 静默，不阻塞唤端）：scheme=发起即记
      // （净屏同口径——openURL 的 promise reject 只证明未装闲鱼，唤端意图已发生）
      trackXianyuClick('scheme')
      void Linking.openURL(`fleamarket://item?id=${order.xianyuItemId}`).catch(() => {
        trackXianyuClick('fallback')
        if (order.xianyuUrl) void openUrl(order.xianyuUrl)
      })
      return
    }
    trackXianyuClick('legacy')
    if (order.xianyuUrl) void openUrl(order.xianyuUrl)
    else toast(t('checkout_no_xianyu_url'))
  }, [order.xianyuItemId, order.xianyuUrl, t])

  const handleCopyNo = useCallback(() => {
    void Clipboard.setString(order.orderNo)
    hapticSelection()
    toast(t('checkout_copied'))
  }, [order.orderNo, t])

  return (
    <PageContent>
      <View style={[styles.container, { paddingTop: headerTotal }]}>
        <AnimatedScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.hero}>
            <Text size={12} color={theme['c-font-label']} style={styles.orderNoText}>{order.orderNo}</Text>
            <Text size={38}>{`¥${yuan(order.amountCents)}`}</Text>
            <Text size={14} color={theme['c-font-label']} style={styles.heroSku}>{names || order.desc}</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme['c-primary'] }]}
            activeOpacity={0.7}
            onPress={handleOpenXianyu}
          >
            <Text size={16} color={theme['c-on-primary']}>{t('checkout_open_xianyu')}</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: theme['c-content-background'] }]}>
            {(['checkout_step1', 'checkout_step2', 'checkout_step3'] as const).map((key, idx) => (
              <View key={key} style={[styles.step, idx < 2 && { borderBottomColor: theme['c-border-background'], borderBottomWidth: 0.5 }]}>
                <View style={[styles.stepN, { backgroundColor: theme['c-border-background'] }]}>
                  <Text size={12} color={theme['c-font-label']}>{idx + 1}</Text>
                </View>
                <Text size={14} style={styles.stepText}>{t(key)}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.card, styles.copyRow, { backgroundColor: theme['c-content-background'] }]}
            activeOpacity={0.7}
            onPress={handleCopyNo}
          >
            <Text size={13}>
              {t('checkout_order_no')}
              <Text size={12} color={theme['c-font-label']}>{`  ${order.orderNo}`}</Text>
            </Text>
            <Text size={13} color={theme['c-primary']}>{t('checkout_copy')}</Text>
          </TouchableOpacity>

          <View style={[styles.card, styles.serviceRow, { backgroundColor: theme['c-content-background'] }]}>
            <View style={styles.serviceInfo}>
              <Text size={13}>{t('checkout_service_online')}</Text>
              <Text size={11} color={theme['c-font-label']}>{order.serviceHours || t('checkout_service_hours_fallback')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.serviceBtn, { backgroundColor: theme['c-border-background'] }]}
              activeOpacity={0.7}
              onPress={() => { void openUrl(order.contactUrl || `${SHIYIN_BASE_URL}/faq`) }}
            >
              <Text size={12} color={theme['c-font-label']}>{t('checkout_contact_service')}</Text>
            </TouchableOpacity>
          </View>

          <Text size={11} color={theme['c-font-label']} style={styles.footHint}>
            {t('checkout_foot_hint')}
          </Text>

          {delivered
            ? (
              <View style={[styles.deliveredBox, { backgroundColor: theme['c-content-background'] }]}>
                <Text size={14} color={theme.isDark ? SUCCESS_GREEN.dark : SUCCESS_GREEN.light}>{t('checkout_delivered')}</Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.ordersBtn, { backgroundColor: theme['c-primary'] }]}
                  activeOpacity={0.7}
                  onPress={() => { pushScreen(ORDERS_SCREEN) }}
                >
                  <Text size={15} color={theme['c-on-primary']}>{t('checkout_go_orders')}</Text>
                </TouchableOpacity>
              </View>
              )
            : (
              <TouchableOpacity
                style={[styles.ghostBtn, { borderColor: theme['c-border-background'] }, polling && { opacity: 0.6 }]}
                activeOpacity={0.7}
                onPress={handlePaid}
                disabled={polling}
              >
                <Text size={14} color={theme['c-font-label']}>
                  {polling ? t('checkout_polling') : t('checkout_i_paid')}
                </Text>
              </TouchableOpacity>
              )}
          <View style={styles.tail} />
        </AnimatedScrollView>
      </View>
      <ScreenHeader componentId={componentId} title={t('checkout_title')} progress={scrollY} />
    </PageContent>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.s28,
  },
  hero: {
    alignItems: 'center',
    paddingTop: SPACING.s18,
    paddingBottom: SPACING.s6,
  },
  orderNoText: {
    marginBottom: SPACING.s6,
  },
  heroSku: {
    marginTop: SPACING.s4,
  },
  primaryBtn: {
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: SPACING.s14,
    marginHorizontal: SPACING.s16,
    marginVertical: SPACING.s10,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: SPACING.s16,
    paddingVertical: SPACING.s6,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s10,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
    paddingVertical: SPACING.s10,
  },
  stepN: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.s14,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.s12,
  },
  serviceInfo: {
    gap: 2,
  },
  serviceBtn: {
    borderRadius: 999,
    paddingHorizontal: SPACING.s12,
    paddingVertical: SPACING.s6,
  },
  footHint: {
    textAlign: 'center',
    paddingHorizontal: SPACING.s20,
    paddingTop: SPACING.s4,
    lineHeight: 18,
  },
  deliveredBox: {
    borderRadius: 16,
    alignItems: 'center',
    padding: SPACING.s16,
    marginHorizontal: SPACING.s16,
    marginTop: SPACING.s10,
    gap: SPACING.s12,
  },
  ordersBtn: {
    alignSelf: 'stretch',
    marginHorizontal: 0,
    marginTop: 0,
  },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: SPACING.s12,
    marginHorizontal: SPACING.s16,
    marginTop: SPACING.s10,
  },
  tail: {
    height: SPACING.s28,
  },
})
