// 选购页（批3，方案 doc/plans/shiyin-order-domain.md §四批3 v1.2 修订节；效果图 v4 定稿
// doc/mockups/shiyin-purchase-screens-v4.html）。形态 A=音源胶囊 tab×档位纵向列表（对标
// Apple 订阅页分段选择）；分态权益卡；跨 tab 多选购物车式组合（同音源替换/跨音源叠加/
// 点已选取消/切 tab 不清，审查 I5 拍板=全源×单源硬互斥——选中全源禁单源 tab，Apple One
// 「已包含」形态）；组合折扣按音源数打折不设档位门槛（方案 C），吸底栏实时算价
// （comboTotalCents 与服务端 DiscountPerMille HALF_UP 同口径）。
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, TouchableOpacity, View } from 'react-native'

import { AnimatedScrollView } from '@/components/common/AnimatedLists'
import ScreenHeader from '@/components/common/ScreenHeader'
import PageContent from '@/components/PageContent'
import Text, { FontFamilies } from '@/components/common/Text'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { SCREEN_HEADER_HEIGHT, SUCCESS_GREEN, ICON_SIZE } from '@/config/constant'
import { Icon } from '@/components/common/Icon'
import { useStatusbarHeight } from '@/store/common/hook'
import { useActivationState, activateByCode, APP_CN, formatRemainHint, isExpiringSoonAt } from '@/core/shiyin/activation'
import InputSheet, { type InputSheetType } from '@/components/common/InputSheet'
import {
  fetchSkus,
  getCachedCatalog,
  isSkusCacheStale,
  comboTotalCents,
  rateFor,
  createOrder,
  orderErrorKey,
  yuan,
  isForeverSku,
  SOURCE_KEYS,
  type Sku,
  type SkusCatalog,
  type SourceKey,
} from '@/core/shiyin/order'
import { pushCheckoutScreen } from '@/navigation/navigation'
import type { ActivationStateInfo } from '@/utils/nativeModules/activation'
import type { Message } from '@/lang'

type TabKey = 'shiyin' | SourceKey
type Translate = (k: keyof Message, p?: Record<string, string | number | boolean>) => string

// 折扣率 → i18n 占位（zh「{r} 折」/ en「{p}% off」）：950→{r:9.5,p:5}。zh 恒除 100
// (批3代码审 C-A：非整百分支 /1000 会把 950 显成「0.95 抷」，错一个数量级）
const rateArgs = (rate: number): { r: string, p: string } => {
  const zh = String(rate / 100)
  const off = String((1000 - rate) / 10)
  return { r: zh, p: off }
}

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const { info, refresh: refreshActivation } = useActivationState()

  // 页头输码入口（Q4-B，2026-11-02 拍板=净屏购买页顶部输码入口同构；对标 App Store/Google
  // Play 兑换码=页头级入口不占内容版面）：复用 InputSheet+activateByCode（含 Q7 合并确认
  // 链与 busy 反馈），成功后刷新页内权益态（useActivationState.refresh——bridge
  // onEntitlementChanged 事件亦会自动刷新，此处显式调用防事件时序差）
  const inputSheetRef = useRef<InputSheetType>(null)
  const [redeeming, setRedeeming] = useState(false)
  const handleSheetActivate = useCallback((sheetCode: string) => {
    if (redeeming) return
    setRedeeming(true)
    inputSheetRef.current?.setBusy(true)
    void activateByCode(sheetCode, () => {
      inputSheetRef.current?.hide()
      refreshActivation()
    }).finally(() => {
      setRedeeming(false)
      inputSheetRef.current?.setBusy(false)
    })
  }, [redeeming, refreshActivation])

  const [catalog, setCatalog] = useState<SkusCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  // 缓存陈旧标注（Q1-D）：>7 天秒开+「价格以支付页为准」标注（有意偏离净屏 S3 的超龄强制
  // 拉新，复审产品席 S2 知情偏离）；后台刷新成功即消失
  const [stale, setStale] = useState(false)
  // 购物车：sku.id → Sku（跨 tab 不清；同源替换；点已选取消）
  const [cart, setCart] = useState<Record<string, Sku>>({})
  const [activeTab, setActiveTab] = useState<TabKey>('shiyin')
  const [submitting, setSubmitting] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const scrollY = useRef(new Animated.Value(0)).current

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    void fetchSkus().then(next => {
      if (!mounted.current) return
      setCatalog(next)
      setLoading(false)
    }).catch(() => {
      if (!mounted.current) return
      setFailed(true)
      setLoading(false)
    })
  }, [])

  // 两段式（Q1-B，2026-11-02 拍板 SWR=净屏 PlanSkus cached 同构）：有缓存立即渲染（loading
  // 不出现，秒开）+后台静默刷新回写；刷新失败静默保留缓存；仅无缓存才走 loading→sync→failed
  // 现状链。in-flight 去重在 fetchSkus 层（order.ts 模块级单例），与 Home 预热带并发不重复请求
  useEffect(() => {
    void (async() => {
      const cached = await getCachedCatalog()
      if (!mounted.current) return
      if (cached == null) {
        load()
        return
      }
      setCatalog(cached)
      setLoading(false)
      void isSkusCacheStale().then(st => { if (mounted.current) setStale(st) })
      void fetchSkus().then(next => {
        if (!mounted.current) return
        setCatalog(next)
        setStale(false)
      }).catch(() => {})
    })()
  }, [load])

  const cartItems = useMemo(() => Object.values(cart), [cart])
  const hasAllSource = useMemo(() => cartItems.some(s => s.apps[0] == 'shiyin'), [cartItems])
  const hasSingleSource = useMemo(() => cartItems.some(s => s.apps[0] != 'shiyin'), [cartItems])
  const sourceCount = useMemo(() => new Set(cartItems.map(s => s.apps[0])).size, [cartItems])
  const rawTotal = useMemo(() => cartItems.reduce((acc, s) => acc + s.priceCents, 0), [cartItems])
  const totalCents = catalog != null && cartItems.length > 0
    ? comboTotalCents(catalog, cartItems.map(s => s.priceCents), sourceCount)
    : 0
  const currentRate = catalog != null && cartItems.length > 0 ? rateFor(catalog, sourceCount) : 1000
  const rate = rateArgs(currentRate)

  // 硬互斥（审查 I5 拍板）：全源与单源不同车；同源替换；点已选取消
  // （2026-11-03 全源停售拍板：停售后全源分支不可达——保留为存量缓存目录与日后恢复发售兼容，
  // 摘除需同步动 toggleSku/tabLocked 两处，收益为零故不动）
  const toggleSku = useCallback((sku: Sku) => {
    const source = sku.apps[0]
    setCart(prev => {
      if (source == 'shiyin' && Object.values(prev).some(s => s.apps[0] != 'shiyin')) return prev
      if (source != 'shiyin' && Object.values(prev).some(s => s.apps[0] == 'shiyin')) return prev
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (next[id].apps[0] == source && id != sku.id) delete next[id]
      }
      if (next[sku.id] != null) delete next[sku.id]
      else next[sku.id] = sku
      return next
    })
  }, [])

  const handlePay = useCallback(() => {
    if (!cartItems.length || catalog == null || submitting) return
    // native_checkout 应急闸前置拦截（批2 契约：关=建单 409；409 兜底文案仍在 orderErrorKey）
    if (!catalog.nativeCheckout) {
      toast(t('order_err_paused'))
      return
    }
    setSubmitting(true)
    // F-18（批5）：sku 串段排序归一——同集合异顺序（购物车加入序不同）绕过
    // client_token 幂等=重复建单（旧单 48h 自动关）；服务端 checkTokenReplay 同批归一
    void createOrder(cartItems.map(i => i.id).sort().join('+')).then(order => {
      if (!mounted.current) return
      setSubmitting(false)
      // names=选中档位运营名（购物车加入序）——支付引导页商品名与购买页同源（七题回归
      // 反馈：order.desc=服务端合成规格串）
      pushCheckoutScreen(componentId, order, cartItems.map(i => i.name).join(' + '))
    }).catch(err => {
      if (!mounted.current) return
      setSubmitting(false)
      toast(t(orderErrorKey(err as Error)))
    })
  }, [cartItems, catalog, submitting, componentId, t])

  const tabEntries = useMemo(() => {
    const badgeOf = (source: string) => cartItems.filter(s => s.apps[0] == source).length
    const list: Array<{ key: TabKey, label: string, disabled: boolean, badge: number }> = []
    // 全源 tab 服务端驱动（2026-11-03 全源停售拍板）：目录无全源档位=不出 tab，
    // 与下方单源 tab 的 2026-11-02 拍板同模式——服务端日后恢复发售自动出现，无需改客户端
    if ((catalog?.allSource.length ?? 0) > 0) {
      list.push({
        key: 'shiyin',
        label: t('purchase_tab_all'),
        disabled: hasSingleSource,
        badge: badgeOf('shiyin'),
      })
    }
    for (const key of SOURCE_KEYS) {
      // 未开放售卖的源不出 tab（2026-11-02 用户拍板）：目录无该源档位=服务端未开通，点进
      // 去是空列表；服务端日后发码自动出现，无需改客户端
      if ((catalog?.bySource[key]?.length ?? 0) == 0) continue
      list.push({ key, label: APP_CN[key] ?? key, disabled: hasAllSource, badge: badgeOf(key) })
    }
    return list
  }, [t, catalog, hasSingleSource, hasAllSource, cartItems])

  const tiers = useMemo(() => {
    if (catalog == null) return []
    return activeTab == 'shiyin' ? catalog.allSource : (catalog.bySource[activeTab] ?? [])
  }, [catalog, activeTab])
  // 当前 tab 被互斥锁（对立来源在车）→ 档位行只读
  const tabLocked = activeTab == 'shiyin' ? hasSingleSource : hasAllSource

  // 目录刷新后当前组可能失去档位（服务端下架/未开放/全源停售）→ 回落首个可用组
  // （防空白列表；2026-11-03 全源停售拍板：全源组空时回落目标改为首个有档位的单源）
  useEffect(() => {
    if (catalog == null) return
    const firstAvailable = (): TabKey | null => {
      if (catalog.allSource.length > 0) return 'shiyin'
      return SOURCE_KEYS.find(k => (catalog.bySource[k]?.length ?? 0) > 0) ?? null
    }
    const empty = activeTab == 'shiyin'
      ? catalog.allSource.length == 0
      : (catalog.bySource[activeTab]?.length ?? 0) == 0
    if (empty) {
      const next = firstAvailable()
      if (next != null && next != activeTab) setActiveTab(next)
    }
  }, [catalog, activeTab])

  const handleRetry = useCallback(() => { load() }, [load])
  const isEmpty = catalog != null && catalog.allSource.length == 0 &&
    SOURCE_KEYS.every(k => (catalog.bySource[k]?.length ?? 0) == 0)

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
          {loading
            ? (
              // 首次无缓存骨架屏（Q1 体感配套，2026-11-02 二次拍板：净屏原生页框架先渲染
              // 同构——链路 TTFB ~2.4s 期间展示布局占位而非一行字，等待可感知可控；占位
              // 形态对齐 tabs 行+档位卡真实布局）
              <View style={styles.skeletonWrap}>
                <View style={styles.skelTabs}>
                  {[64, 72, 72, 72].map((w, i) => (
                    <View key={i} style={[styles.skelTab, { backgroundColor: theme['c-content-background'] }, { width: w }]} />
                  ))}
                </View>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={[styles.skelCard, { backgroundColor: theme['c-content-background'] }]}>
                    <View style={[styles.skelTick, { backgroundColor: theme['c-border-background'] }]} />
                    <View style={styles.skelLines}>
                      <View style={[styles.skelLine, { width: '52%', backgroundColor: theme['c-border-background'] }]} />
                      <View style={[styles.skelLine, { width: '34%', backgroundColor: theme['c-border-background'] }]} />
                    </View>
                    <View style={[styles.skelPrice, { backgroundColor: theme['c-border-background'] }]} />
                  </View>
                ))}
              </View>
              )
            : failed || catalog == null
              ? (
                <View style={styles.center}>
                  <Text size={13} color={theme['c-font-label']}>{t('purchase_failed')}</Text>
                  <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme['c-primary'] }]} onPress={handleRetry}>
                    <Text size={13} color={theme['c-on-primary']}>{t('shiyin_retry')}</Text>
                  </TouchableOpacity>
                </View>
                )
                : isEmpty
                  ? (
                    <View style={styles.center}><Text size={13} color={theme['c-font-label']}>{t('purchase_empty')}</Text></View>
                    )
                    : (
                      <>
                        <EntitlementCard info={info} t={t} />
                        <View style={styles.tabs}>
                          {tabEntries.map(entry => (
                            <TouchableOpacity
                              key={entry.key}
                              style={[
                                styles.tab,
                                { backgroundColor: theme['c-content-background'], borderColor: theme['c-border-background'] },
                                entry.key == activeTab && { backgroundColor: theme['c-primary'], borderColor: theme['c-primary'] },
                                entry.disabled && styles.tabDisabled,
                              ]}
                              disabled={entry.disabled}
                              activeOpacity={0.7}
                              onPress={() => { setActiveTab(entry.key) }}
                            >
                              <Text
                                size={13}
                                style={entry.key == activeTab ? styles.tabTextActive : styles.tabText}
                                color={entry.key == activeTab ? theme['c-on-primary'] : theme['c-font-label']}
                              >
                                {entry.label}
                              </Text>
                              {entry.badge > 0 && (
                                <View style={[styles.tabBadge, { backgroundColor: entry.key == activeTab ? theme['c-on-primary'] : theme['c-primary'] }]}>
                                  <Text size={10} color={entry.key == activeTab ? theme['c-primary'] : theme['c-on-primary']}>
                                    {entry.badge}
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                        <PromoStrip catalog={catalog} t={t} primaryColor={theme['c-primary']} />
                        {stale && (
                          <Text size={11} color={theme['c-font-label']} style={styles.priceHint}>{t('purchase_price_hint')}</Text>
                        )}
                        {tiers.map(sku => (
                          <TierRow
                            key={sku.id}
                            sku={sku}
                            selected={cart[sku.id] != null}
                            locked={tabLocked}
                            theme={theme}
                            t={t}
                            onToggle={toggleSku}
                          />
                        ))}
                        <View style={styles.listTail} />
                      </>
                    )}
        </AnimatedScrollView>
      </View>
      {catalog != null && cartItems.length > 0 && (
        <View style={[styles.paybar, { backgroundColor: theme['c-content-background'], borderTopColor: theme['c-border-background'] }]}>
          <View style={styles.paySums}>
            <Text size={11} color={theme['c-font-label']}>
              {currentRate < 1000
                ? t('purchase_selected_discount', { n: cartItems.length, r: rate.r, p: rate.p })
                : t('purchase_selected_n', { n: cartItems.length })}
            </Text>
            <View style={styles.payPriceRow}>
              {currentRate < 1000 && <Text size={12} color={theme['c-font-label']} style={styles.priceOld}>{`¥${yuan(rawTotal)}`}</Text>}
              <Text size={20} color={theme['c-primary']}>{`¥${yuan(totalCents)}`}</Text>
              {currentRate < 1000 && (
                <View style={[styles.saveBadge, { backgroundColor: theme['c-primary'] }]}>
                  <Text size={10} color={theme['c-on-primary']}>
                    {t('purchase_save', { amount: yuan(rawTotal - totalCents) })}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: submitting ? theme['c-primary-dark-100'] : theme['c-primary'] }]}
            activeOpacity={0.7}
            onPress={handlePay}
            disabled={submitting}
          >
            <Text size={14} color={theme['c-on-primary']}>
              {submitting ? t('purchase_submitting') : t('purchase_pay')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <InputSheet
        ref={inputSheetRef}
        title={t('purchase_title')}
        placeholder={t('activation_input_hint')}
        confirmText={t('activation_btn_activate')}
        onConfirm={handleSheetActivate}
      />
      <ScreenHeader
        componentId={componentId}
        title={t('purchase_title')}
        progress={scrollY}
        right={
          /* ③页头动作图标化（2026-11-04 拍板）：文字「输码」→key 图标，与订单页找回/
             DislikeManage 页头图标同形态；redeeming 防重入态保留 */
          <TouchableOpacity
            style={styles.headerEntry}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => { inputSheetRef.current?.show() }}
            disabled={redeeming}
          >
            <Icon name="key" size={ICON_SIZE.nav} color={theme['c-font']} />
          </TouchableOpacity>
        }
      />
    </PageContent>
  )
}

// 分态权益卡（批3 v1.2）：未激活/永久=隐藏；试用=🎁剩 N 天全源；全源=✅至 date（≤3 天
// 警示橙，审查 I-C 补拍板态）；纯音源权益=单源名+日期或 N 源摘要（exp==0 永久=生效中
// 计入，批3代码审 I4 同批口径统一）。数据=SDK expiries，shiyin 兜底判定 unlockSource 同源
const EntitlementCard = memo(({ info, t }: { info: ActivationStateInfo | null, t: Translate }) => {
  const theme = useTheme()
  if (info == null || info.expiries == null || info.state != 'active') return null
  const warningColor = 'rgb(255,149,10)' // HIG systemOrange（主题无 warning token，ExpiryBanner 同款）
  const successColor = theme.isDark ? SUCCESS_GREEN.dark : SUCCESS_GREEN.light
  const allExp = info.expiries.shiyin
  if (info.isTrial && allExp != null) {
    const hint = formatRemainHint(allExp, t)
    if (!hint) return null
    return (
      <View style={[styles.entCard, { backgroundColor: theme['c-content-background'] }]}>
        <Text size={13} color={theme['c-font-label']}>{t('purchase_ent_trial', { hint })}</Text>
      </View>
    )
  }
  if (allExp != null) {
    if (allExp == 0) return null // 永久不提示
    const soon = isExpiringSoonAt(allExp)
    return (
      <View style={[styles.entCard, { backgroundColor: theme['c-content-background'] }]}>
        <Text size={13} color={soon ? warningColor : successColor}>
          {soon ? t('purchase_ent_all_soon', { date: fmtDate(allExp) }) : t('purchase_ent_all', { date: fmtDate(allExp) })}
        </Text>
      </View>
    )
  }
  // live 含永久（exp==0=生效中，批3代码审 I4：与 activation.ts 同批口径统一）
  const live: Array<[string, number]> = Object.entries(info.expiries).filter(([, exp]) => exp == 0 || exp * 1000 > Date.now())
  if (!live.length) return null
  const first = live[0]
  const label = live.length == 1
    ? t('purchase_ent_source', { name: APP_CN[first[0]] ?? first[0], date: first[1] == 0 ? t('activation_permanent') : fmtDate(first[1]) })
    : t('purchase_ent_sources', { n: live.length })
  const anySoon = live.some(([, exp]) => exp != 0 && isExpiringSoonAt(exp))
  return (
    <View style={[styles.entCard, { backgroundColor: theme['c-content-background'] }]}>
      <Text size={13} color={anySoon ? warningColor : successColor}>{label}</Text>
    </View>
  )
})

const fmtDate = (unixSec: number): string => {
  const d = new Date(unixSec * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 促销横幅（动态渲染全部折扣档 r<1000，优化师 S1：配置化后不锁 n2-n3 硬窗口）
const PromoStrip = memo(({ catalog, t, primaryColor }: { catalog: SkusCatalog, t: Translate, primaryColor: string }) => {
  const parts: string[] = []
  for (const rate of catalog.comboRates) {
    if (rate.n >= 2 && rate.r < 1000) {
      const args = rateArgs(rate.r)
      parts.push(t('purchase_promo_tier', { n: rate.n, r: args.r, p: args.p }))
    }
  }
  if (!parts.length) return null
  return (
    <View style={styles.promoStrip}>
      <Text size={12} color={primaryColor}>
        {t('purchase_promo', { offers: parts.join(' · ') })}
      </Text>
    </View>
  )
})

// 档位行卡（形态 A 纵向列表）：勾选圆点+档名+meta（音源归属/设备数）+价格
const TierRow = memo(({ sku, selected, locked, theme, t, onToggle }: {
  sku: Sku
  selected: boolean
  locked: boolean
  theme: any
  t: Translate
  onToggle: (sku: Sku) => void
}) => {
  const sourceLabel = sku.apps[0] == 'shiyin' ? t('purchase_ent_all_badge') : (APP_CN[sku.apps[0]] ?? sku.apps[0])
  return (
    <TouchableOpacity
      style={[styles.tierRow, { backgroundColor: theme['c-content-background'] }, selected && { borderColor: theme['c-primary'], borderWidth: 1.5 }]}
      activeOpacity={locked ? 1 : 0.7}
      onPress={() => { if (!locked) onToggle(sku) }}
      disabled={locked}
    >
      <View style={[styles.tick, { backgroundColor: selected ? theme['c-primary'] : theme['c-border-background'] }]}>
        {selected && <Text size={12} color={theme['c-on-primary']}>✓</Text>}
      </View>
      <View style={styles.tierInfo}>
        <Text size={15} style={{ fontWeight: '600' }}>{sku.name}</Text>
        <Text size={12} color={theme['c-font-label']} style={styles.tierMeta}>
          {t('purchase_tier_meta', { source: sourceLabel, devices: sku.deviceLimit })}
        </Text>
      </View>
      {/* 永久档=「永久 ¥x」并排（S6 简化：单一条件渲染，¥ 字号口径统一小字+大额） */}
      <Text size={18} color={theme['c-primary']} style={{ fontWeight: '700' }}>
        {isForeverSku(sku) && <Text size={12}>{t('purchase_price_forever')} </Text>}
        <Text size={12}>¥</Text>{yuan(sku.priceCents)}
      </Text>
    </TouchableOpacity>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.s28,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: SPACING.s16,
    gap: SPACING.s12,
  },
  // 骨架屏（Q1 体感配套）：占位形态对齐 tabs 行+档位卡真实布局（TierRow 视觉：
  // 圆角 16/横向/勾选圆点+双行文案+右侧价格块）
  skeletonWrap: {
    paddingTop: SPACING.s16,
  },
  skelTabs: {
    flexDirection: 'row',
    gap: SPACING.s8,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s16,
  },
  skelTab: {
    height: 34,
    borderRadius: 999,
  },
  skelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
    borderRadius: 16,
    padding: SPACING.s16,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s10,
    height: 76,
  },
  skelTick: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  skelLines: {
    flex: 1,
    gap: SPACING.s8,
  },
  skelLine: {
    height: 13,
    borderRadius: 6,
  },
  skelPrice: {
    width: 48,
    height: 18,
    borderRadius: 6,
  },
  retryBtn: {
    borderRadius: 999,
    paddingHorizontal: SPACING.s20,
    paddingVertical: SPACING.s10,
  },
  entCard: {
    borderRadius: 12,
    paddingHorizontal: SPACING.s14,
    paddingVertical: SPACING.s10,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s12,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.s8,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s8,
  },
  tab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: SPACING.s14,
    // 固定高度+垂直居中（Q3-B）：pill 高度与文字行盒解耦，防切 tab 时 CJK 度量差引 pill 高低
    // 不平（34=现状视觉值 paddingVertical 8×2+13 号行盒推导，真机回归量取校准——复审优化师 S-2）
    height: 34,
    justifyContent: 'center',
  },
  // 选中态字族切换（Q3-A，对齐 Text.tsx「不做 fontWeight 合成」拍板+CategoryChips 先例）：
  // 裸 fontWeight 在 Android 触发 CJK 回退粗体档换行盒→选中文字基线上浮（真机实证）；静态族
  // 度量恒定。semibold 档=本产品自定（复审产品席 S3：页面主操作 tab 较筛选 chip 需更强选中强调，
  // 与主色实底反白双通道叠加）
  tabText: {
    fontFamily: FontFamilies.medium,
  },
  tabTextActive: {
    fontFamily: FontFamilies.semibold,
  },
  tabDisabled: {
    opacity: 0.35,
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  promoStrip: {
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s12,
    paddingVertical: SPACING.s8,
    paddingHorizontal: SPACING.s12,
    borderRadius: 10,
    backgroundColor: 'rgba(250,35,59,0.08)',
  },
  // 缓存陈旧标注（Q1-D）：>7 天缓存秒开时显示，后台刷新成功即消失
  priceHint: {
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s12,
    marginTop: -SPACING.s4,
  },
  // 页头输码入口（Q4-B）：文字按钮热区垫高对齐 44dp 触控基准
  headerEntry: {
    paddingHorizontal: SPACING.s12,
    paddingVertical: SPACING.s8,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
    borderRadius: 16,
    padding: SPACING.s16,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierInfo: {
    flex: 1,
    minWidth: 0,
  },
  tierMeta: {
    marginTop: 2,
  },
  listTail: {
    height: SPACING.s8,
  },
  paybar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s14,
    paddingHorizontal: SPACING.s16,
    paddingTop: SPACING.s12,
    paddingBottom: SPACING.s26,
    borderTopWidth: 0.5,
  },
  paySums: {
    flex: 1,
  },
  payPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s6,
    marginTop: 2,
  },
  priceOld: {
    textDecorationLine: 'line-through',
  },
  saveBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // 精致化（2026-11-02 用户反馈）：去 flex 自适应宽（原 flex:1 吃满剩余空间挤压价格/
  // 折扣区），缩字号缩内距；金额区 flex:1 为主
  payBtn: {
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: SPACING.s8,
    paddingHorizontal: SPACING.s24,
  },
})
