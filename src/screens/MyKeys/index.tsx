// 「我的权益」屏（§五.3 按源展示重构，2026-11-04 六规则拍板定稿+用户追加两决策：
// 页面改叫我的权益/动作收段详情面板。取代原按码卡列表——权益主体从「码」迁「源」：
// 每源一行（仅显示已配置的源，行值=自身键与 shiyin 兜底取较晚者，服务端单源下发
// /api/entitlements）；点击展开贡献段（在役段一行式=码名+起止到日；已耗尽段入
// 「历史激活码」折叠区默认收起纯查看）；点段→段详情面板（码值复制/秒级到期/
// 设备管理/解绑，管理动作挂码条目——拍板「码值复制/设备管理/解绑的入口放段详情」）。
// 数据层=服务端 entitlements 优先（relay 段账本真值），失败回落本地聚合视图
// （getKeyEntries expiries max 口径+本地视图标注，判定真值始终在本地 unlockSource）。
// 保留件：输码入口行+InputSheet 链/剪贴板检测/未购引导卡/三操作在途锁/解绑回落
// 预告（activation.ts unbindDevice）/60s 节流（视图拉取与逐码 binding 共用口径）。
// 视觉微调（2026-11-04 拍板）：入口卡统一 12 圆角（加挂 card）；行首图标三处裸化
// 去圆底（key/plus/music 裸 20 主色，对标 M3 行首裸图标/HIG 应用内列表主流形态）。
// 子卡改版（2026-11-04 grilling 七题+三席方案审定稿）：段=同色平面行组+细分隔线划界（弃灰底嵌套卡）；行1 档位=
// sku_name 直出（缺失 free 兑「试用/赠送」paid 兑「正式」，free 兑底命中省徽标防同
// 词重复）；行2 完整码 tap 复制（脱敏退役，泄露面用户拍板接受）；行3 起止（排队段=
// 「待生效 X 起 · 至 Y」，end=0 变体「· 永久」）；行4 到期时刻 h:m:s（兜 seg.valid，
// 永久/历史段不显）；行内解绑=正式段+valid+bindings 回填后显（stale mark 误显收敛为
// 零，拍板 I-5）。面板瘦身为设备面板（信息行全在段行组；设备开关行三态 mark 均渲染=
// 修复 UNBOUND 时绑回钮不可达死路径，审查 I-4 随批修）。排队态=服务端段 state 单源
// 三态 active|queued|expired（空串/undefined 回落 valid 两态，T4 判定族口径 RN 不自算）。
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Image, Modal, TouchableOpacity, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'

import { AnimatedScrollView } from '@/components/common/AnimatedLists'
import ScreenHeader from '@/components/common/ScreenHeader'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import InputSheet, { type InputSheetType } from '@/components/common/InputSheet'
import { createStyle, toast } from '@/utils/tools'
import { hapticSelection } from '@/utils/haptic'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { BorderWidths } from '@/theme'
import { ICON_SIZE, DESTRUCTIVE_RED, SCREEN_HEADER_HEIGHT, SUCCESS_GREEN } from '@/config/constant'
import { useStatusbarHeight } from '@/store/common/hook'
import { dateFormat } from '@/utils'
import { pushPurchaseScreen } from '@/navigation/navigation'
import { onEntitlementChanged, BINDING_MARK, SEG_STATE, type KeyEntry, type BindingInfo, type EntSourceView, type EntSegmentView } from '@/utils/nativeModules/activation'
import { activationModule } from '@/utils/nativeModules/activation'
import {
  useActivationState,
  activateByCode,
  unbindDevice,
  rebindKey,
  unbindRemoteDevice,
  detectClipboardCandidate,
  APP_CN,
} from '@/core/shiyin/activation'

const BINDING_FETCH_INTERVAL = 60 * 1000

// 触控命中区补偿（代码审查 I-A：行内小号文字钮命中区补至 ≈44px，视觉密度不变——
// HIG 允许可见元素小于命中区；left 补偿解绑小钮的左向热区）
const HIT_SLOP_V = { top: 12, bottom: 12, left: 12 }

// 源官方图标（2026-11-04 装机反馈拍板：各音源用官方 logo，圆角矩形渲染；资产=各平台
// iOS 官方 App 图标 512px 落仓，新源上线随源补图）
const SOURCE_ICONS: Record<string, number> = {
  tx: require('@/resources/images/sources/tx.png'),
  wy: require('@/resources/images/sources/wy.png'),
  kg: require('@/resources/images/sources/kg.png'),
  kw: require('@/resources/images/sources/kw.png'),
}

// 段行2 完整码直出（2026-11-04 子卡改版拍板 Q3）：脱敏退役，tap 复制交互承接原面板
// 码值行；码=可兑换资产，列表页截图暴露面用户已知情拍板接受

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  // 悬浮页头让位（About 同款 headerTotal 管线：内容从玻璃底下穿行）
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const { info } = useActivationState() // state 消费：未购态判据（审查 I-I：全停权用户也需剪贴板提示）
  const [entries, setEntries] = useState<KeyEntry[]>([])
  const [bindings, setBindings] = useState<Record<string, BindingInfo>>({})
  // submitting（A-3 防重锁单源）：提交中锁全部触发（弹窗文本由 InputSheet 自管）
  // 标准二级页滚动接线（玻璃渐显+标题淡入，About 同款）
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])
  const [clipCandidate, setClipCandidate] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputSheetRef = useRef<InputSheetType>(null)
  // 60s/码网络校验节流缓存（S-架构2：动作成功后 force）
  const bindingCache = useRef(new Map<string, { at: number, info: BindingInfo }>())
  // 在途去重（审查 S9）：动作回刷新与权益事件几乎同时触发时只跑一轮逐码循环
  const fetchingBindings = useRef(false)
  const mounted = useRef(true)

  // §五.3 按源视图状态：serverSources=null=服务端视图不可得（回落本地聚合，serverFailed
  // 标注）；60s 节流与逐码 binding 共用口径
  const [serverSources, setServerSources] = useState<EntSourceView[] | null>(null)
  const [serverFailed, setServerFailed] = useState(false)
  const entFetchedAt = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const refreshEntries = useCallback((forceKey?: string) => {
    void activationModule.getKeyEntries().then(next => {
      if (!mounted.current) return
      setEntries(next)
      if (fetchingBindings.current) return
      fetchingBindings.current = true
      // 逐码串行网络刷新（S-架构4；60s 节流，二次进页零请求）——本地 mark 已先行渲染
      void (async() => {
        try {
          for (const e of next) {
            if (!mounted.current) return
            const hit = bindingCache.current.get(e.key)
            if (e.key != forceKey && hit && Date.now() - hit.at < BINDING_FETCH_INTERVAL) continue
            const binding = await activationModule.getBindingInfo(e.key).catch(() => null)
            if (binding) {
              bindingCache.current.set(e.key, { at: Date.now(), info: binding })
              if (mounted.current) setBindings(prev => ({ ...prev, [e.key]: binding }))
            }
          }
        } finally {
          fetchingBindings.current = false
        }
      })()
    }).catch(() => {})
  }, [])

  const fetchEntitlements = useCallback((force = false) => {
    if (!force && Date.now() - entFetchedAt.current < BINDING_FETCH_INTERVAL) return
    entFetchedAt.current = Date.now()
    void activationModule.getEntitlements().then(v => {
      if (!mounted.current) return
      if (v != null && v.length > 0) {
        setServerSources(v)
        setServerFailed(false)
      } else {
        // 空数组=合法空态（无在绑码）；null=拉取失败
        if (v != null) setServerSources(v)
        setServerFailed(v == null)
      }
    }).catch(() => {
      if (mounted.current) setServerFailed(true)
    })
  }, [])

  useEffect(() => {
    refreshEntries()
    fetchEntitlements(true)
    return onEntitlementChanged(() => {
      refreshEntries()
      fetchEntitlements()
    })
  }, [refreshEntries, fetchEntitlements])

  // 未购态=SDK state 口径（审查 I-I）：全停权（码全带 mark/被清）时 getState 返回 Unactivated
  const unactivated = info == null || info.state == 'unactivated'

  // 剪贴板检测（净屏规则，A-1）：仅未购态、进页检测命中显示提示行点击填入
  useEffect(() => {
    setClipCandidate(null)
    if (!unactivated) return
    void Clipboard.getString().then(text => {
      setClipCandidate(detectClipboardCandidate(text))
    }).catch(() => {})
  }, [unactivated])

  // 已购态输码弹层（InputSheet 标准容器）：成功回调里关层+刷新
  const handleSheetActivate = useCallback((sheetCode: string) => {
    if (submitting) return
    setSubmitting(true)
    inputSheetRef.current?.setBusy(true)
    void activateByCode(sheetCode, () => {
      inputSheetRef.current?.hide()
      refreshEntries()
      fetchEntitlements(true)
    }).finally(() => {
      setSubmitting(false)
      inputSheetRef.current?.setBusy(false)
    })
  }, [fetchEntitlements, refreshEntries, submitting])

  // 三操作在途锁（审查 I-C）：任一码操作在途时禁用全部码操作钮
  const [actingKey, setActingKey] = useState<string | null>(null)

  const handleUnbind = useCallback((key: string) => {
    if (actingKey != null) return
    setActingKey(key)
    void unbindDevice(key, () => {
      bindingCache.current.delete(key)
      refreshEntries(key)
      fetchEntitlements(true)
    }).finally(() => { setActingKey(null) })
  }, [actingKey, fetchEntitlements, refreshEntries])

  const handleRebind = useCallback((key: string) => {
    if (actingKey != null) return
    setActingKey(key)
    void rebindKey(key, () => {
      bindingCache.current.delete(key)
      refreshEntries(key)
      fetchEntitlements(true)
    }).finally(() => { setActingKey(null) })
  }, [actingKey, fetchEntitlements, refreshEntries])

  const handleUnbindRemote = useCallback((key: string, deviceId: string) => {
    if (actingKey != null) return
    setActingKey(key)
    void unbindRemoteDevice(key, deviceId, () => {
      bindingCache.current.delete(key)
      refreshEntries(key)
      fetchEntitlements(true)
    }).finally(() => { setActingKey(null) })
  }, [actingKey, fetchEntitlements, refreshEntries])

  const handleRefreshBinding = useCallback((key: string) => {
    bindingCache.current.delete(key)
    refreshEntries(key)
  }, [refreshEntries])

  const handleCopy = useCallback((key: string) => {
    Clipboard.setString(key)
    hapticSelection()
    toast(t('keyinfo_copied'))
  }, [t])

  // 打开输码弹窗：剪贴板候选预填
  const handleOpenInputDialog = useCallback(() => {
    if (clipCandidate) {
      inputSheetRef.current?.showWithText(clipCandidate)
    } else {
      inputSheetRef.current?.show()
    }
  }, [clipCandidate])

  // 配置源到账重渲（2026-11-04 ⑧拍板保留）：本地回落视图按 qualityList 过滤读，
  // SWR 刷新/首启缓存到账时页内自动收敛
  const [sourcesVersion, setSourcesVersion] = useState(0)
  useEffect(() => {
    const handleSourcesUpdated = () => { setSourcesVersion(v => v + 1) }
    global.state_event.on('sourcesUpdated', handleSourcesUpdated)
    return () => { global.state_event.off('sourcesUpdated', handleSourcesUpdated) }
  }, [])

  // 配置源集（六规则①本地回落口径）：qualityList 键集；空集不过滤（首启弱网防闪变，
  // 原码卡 S4 同口径）
  const configuredSources = useMemo(() => Object.keys(global.sy.qualityList ?? {}), [sourcesVersion])

  // 本地回落视图（serverFailed/拉取失败）：getKeyEntries expiries max 口径——每源
  // 行值=max(自身, shiyin 兜底)，段=贡献码单段（start 未知置 0；历史信息本地不可得=空；
  // paid 段 skuName 置空串走行1「正式」兑底——尾号形态退役，审查 I-3 本地侧同语义）
  const localSources = useMemo<EntSourceView[]>(() => {
    const apps = configuredSources.length
      ? configuredSources
      : Array.from(new Set(entries.flatMap(e => Object.keys(e.expiries ?? {}))))
    const out: EntSourceView[] = []
    for (const app of apps) {
      let expiry: number | null = null
      const segs: EntSourceView['segments'] = []
      for (const e of entries) {
        const own = e.expiries?.[app]
        const fb = app == 'shiyin' ? undefined : e.expiries?.shiyin
        const candidates = [own, ...(app == 'shiyin' ? [] : [fb])].filter((v): v is number => v != null)
        if (!candidates.length) continue
        const agg = candidates.some(v => v == 0) ? 0 : Math.max(...candidates)
        if (expiry == null || (expiry != 0 && (agg == 0 || agg > expiry))) expiry = agg
        segs.push({
          key: e.key,
          skuName: e.isTrial ? t('activation_state_trial') : '',
          kind: e.isTrial ? 'free' : 'paid',
          start: 0,
          end: agg,
          valid: agg == 0 || agg * 1000 > Date.now(),
        })
      }
      if (expiry != null) {
        out.push({ app, expiry, valid: expiry == 0 || expiry * 1000 > Date.now(), segments: segs })
      }
    }
    return out
  }, [configuredSources, entries, t])

  // 六规则①「仅显示已配置的源」（2026-11-04 真机修复）：服务端视图同本地口径按
  // qualityList 交集过滤（空集不过滤防首启弱网闪变）；shiyin 兜底键恒排除——全源
  // 权益=各源行各自聚合（六规则「无独立全部音源行」，服务端已收口，此处兜底回落路径）
  const sources = useMemo(() => {
    const raw = serverSources ?? localSources
    return raw.filter(src => src.app != 'shiyin' && (configuredSources.length === 0 || configuredSources.includes(src.app)))
  }, [serverSources, localSources, configuredSources])
  const showLocalNotice = serverFailed && sources.length > 0

  // 段详情面板状态（拍板：码值复制/设备管理/解绑收段详情；秒级到期同面板）
  const [panelSeg, setPanelSeg] = useState<{ seg: EntSegmentView, app: string } | null>(null)
  const [panelDevicesOpen, setPanelDevicesOpen] = useState(false)

  // 面板打开即强制拉该码 binding（设备管理数据源；handleRefreshBinding 清节流缓存，
  // bindings 异步经 refreshEntries 逐码循环回填）
  useEffect(() => {
    if (panelSeg == null) return
    setPanelDevicesOpen(false)
    handleRefreshBinding(panelSeg.seg.key)
  }, [panelSeg, handleRefreshBinding])

  const destructiveColor = theme.isDark ? DESTRUCTIVE_RED.dark : DESTRUCTIVE_RED.light

  const panelEntry = panelSeg != null ? entries.find(e => e.key == panelSeg.seg.key) : undefined
  const panelMark = panelSeg != null ? (bindings[panelSeg.seg.key]?.mark ?? panelEntry?.mark ?? null) : null
  // 网络校验回填后的 binding（审查 I-B：兜底解绑钮显隐判据——不用本地 mark 兜底值，
  // 只认回填真值；面板打开即强制重拉，弱网行内钮缺失时开面板必得可靠入口）
  const panelBinding = panelSeg != null ? bindings[panelSeg.seg.key] : undefined
  const panelDevices = panelSeg != null
    ? [...(bindings[panelSeg.seg.key]?.devices ?? [])].sort((a, b) => (a.isSelf === b.isSelf ? 0 : (a.isSelf ? -1 : 1)))
    : []

  return (
    <PageContent>
      <View style={styles.container}>
        <AnimatedScrollView
          contentContainerStyle={[styles.contentContainer, { paddingTop: headerTotal + SPACING.s16 }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* 输码入口（统一入口行式保留） */}
          <TouchableOpacity
            style={[styles.card, styles.entryCard, { backgroundColor: theme['c-content-background'] }]}
            activeOpacity={0.6}
            onPress={handleOpenInputDialog}
          >
            <Icon name="key" size={20} color={theme['c-primary']} />
            <Text style={styles.entryLabel} size={14}>{unactivated ? t('keyinfo_input_entry_unactivated') : t('keyinfo_input_entry')}</Text>
            <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
          </TouchableOpacity>

          {/* 未购且无码在手：获取引导卡（保留） */}
          {unactivated && !entries.length
            ? (
              <TouchableOpacity
                style={[styles.card, styles.entryCard, { backgroundColor: theme['c-content-background'] }]}
                activeOpacity={0.6}
                onPress={() => { pushPurchaseScreen(componentId) }}
              >
                <Icon name="plus" size={20} color={theme['c-primary']} />
                <View style={styles.emptyTextGroup}>
                  <Text size={14} style={styles.entryLabel}>{t('keyinfo_empty_hint')}</Text>
                  <Text size={12} color={theme['c-font-label']}>{t('keyinfo_empty_desc')}</Text>
                </View>
                <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
              </TouchableOpacity>
              )
            : null}

          {/* 本地视图标注（§五.3：拉取失败回落=概要视图，判定真值不受影响） */}
          {showLocalNotice
            ? (
              <Text size={11} color={theme['c-font-label']} style={styles.localNotice}>{t('ent_local_fallback')}</Text>
              )
            : null}

          {/* 按源行（六规则①②：仅已配置源；行值到日；置灰=已过期） */}
          {sources.map(src => (
            <SourceCard
              key={src.app}
              source={src}
              bindings={bindings}
              acting={actingKey != null}
              onSegPress={seg => { setPanelSeg({ seg, app: src.app }) }}
              onSegCopy={handleCopy}
              onSegUnbind={handleUnbind}
            />
          ))}
        </AnimatedScrollView>
        <PlayerBarPlaceholder />
      </View>

      {/* 输码弹层（保留） */}
      <InputSheet
        ref={inputSheetRef}
        title={t('setting_activation')}
        placeholder={t('activation_input_hint')}
        confirmText={t('activation_btn_activate')}
        onConfirm={handleSheetActivate}
      />

      {/* 段详情面板（子卡改版定稿：瘦身为设备面板——档位/码值/起止/到期时刻/解绑
          全在段行组，此处只留设备管理+绑回；设备开关行三态 mark 均渲染=修复 UNBOUND
          时折叠区永不可开、绑回钮不可达死路径，审查 I-4） */}
      <Modal
        visible={panelSeg != null}
        transparent
        animationType="slide"
        onRequestClose={() => { setPanelSeg(null) }}
      >
        {panelSeg != null
          ? (
            <View style={styles.panelMask}>
              <TouchableOpacity style={styles.panelMaskTouch} activeOpacity={1} onPress={() => { setPanelSeg(null) }} />
              <View style={[styles.panel, { backgroundColor: theme['c-content-background'] }]}>
                <Text size={16} style={styles.panelTitle} color={theme['c-font']}>
                  {panelSeg.seg.skuName || (panelSeg.seg.kind == 'free' ? t('ent_kind_free') : t('ent_kind_paid'))}
                  {panelSeg.seg.kind == 'free' && (panelSeg.seg.skuName || '') != t('ent_kind_free')
                    ? (
                      <Text size={11} color={theme['c-font-label']}>{`  ${t('ent_kind_free')}`}</Text>
                      )
                    : null}
                </Text>
                {/* 设备管理（原码卡绑定折叠区迁入；远程解绑/绑回链复用） */}
                <TouchableOpacity
                  style={styles.panelActionRow}
                  activeOpacity={0.6}
                  onPress={() => { setPanelDevicesOpen(v => !v) }}
                >
                  <Text size={13} color={theme['c-font-label']}>{t('keyinfo_devices_title')} {panelDevicesOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {panelDevicesOpen
                  ? (
                    <View style={styles.panelDevices}>
                      {panelDevices.length
                        ? panelDevices.map(d => (
                          <View key={d.deviceId} style={styles.deviceRow}>
                            <Text size={13} color={theme['c-font-label']} style={styles.deviceInfo}>
                              {d.isSelf ? t('keyinfo_device_self') : (d.deviceName || `…${d.deviceId.slice(-6)}`)}{'\u3000'}{dateFormat(d.boundAt * 1000, 'Y-M-D')}
                            </Text>
                            {!d.isSelf
                              ? (
                                <TouchableOpacity disabled={actingKey != null} onPress={() => { handleUnbindRemote(panelSeg.seg.key, d.deviceId) }}>
                                  <Text size={13} color={destructiveColor}>{t('keyinfo_unbind_device')}</Text>
                                </TouchableOpacity>
                                )
                              : null}
                          </View>
                          ))
                        : (
                          <TouchableOpacity onPress={() => { handleRefreshBinding(panelSeg.seg.key) }}>
                            <Text size={12} color={theme['c-font-label']}>{t('shiyin_retry')}</Text>
                          </TouchableOpacity>
                          )}
                      {panelMark == BINDING_MARK.UNBOUND
                        ? (
                          <TouchableOpacity
                            style={styles.rebindBtn}
                            disabled={actingKey != null}
                            onPress={() => { handleRebind(panelSeg.seg.key); setPanelSeg(null) }}
                          >
                            <Text size={14} color={SUCCESS_GREEN[theme.isDark ? 'dark' : 'light']} style={styles.rebindText}>{t('keyinfo_bind_this')}</Text>
                          </TouchableOpacity>
                          )
                        : null}
                    </View>
                    )
                  : null}
                {/* 兜底解绑（审查 I-B：行内钮 bindings 未回填时静默不显的兜底入口——显隐
                    只认回填真值 panelBinding，试用/赠送/历史段不显；确认链同 handleUnbind） */}
                {panelSeg.seg.kind == 'paid' && panelSeg.seg.valid && panelBinding != null && panelBinding.mark == null
                  ? (
                    <TouchableOpacity
                      style={styles.panelUnbindBtn}
                      disabled={actingKey != null}
                      onPress={() => { handleUnbind(panelSeg.seg.key); setPanelSeg(null) }}
                    >
                      <Text size={14} color={destructiveColor}>{t('activation_btn_unbind')}</Text>
                    </TouchableOpacity>
                    )
                  : null}
                <TouchableOpacity
                  style={[styles.panelCloseBtn, { borderColor: theme['c-border-background'] }]}
                  activeOpacity={0.7}
                  onPress={() => { setPanelSeg(null) }}
                >
                  <Text size={14} color={theme['c-font']}>{t('ent_close')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            )
          : null}
      </Modal>

      <ScreenHeader componentId={componentId} title={t('setting_my_keys')} progress={scrollY} />
    </PageContent>
  )
}

// 按源卡（六规则①②③+装机反馈 2026-11-04；子卡改版 2026-11-04 定稿）：官方 logo
// 圆角矩形+源名+行值**同行**；无折叠箭头——整卡点击展开/收起；展开=段平面行组
// （同色无灰底，细分隔线划界）：行1=档位+kind 徽标+状态三态/行2=完整码 tap 复制/
// 行3=起止（排队段「待生效 X 起 · 至 Y」）/行4=到期时刻 h:m:s；行内解绑=正式段+
// valid+bindings 回填后显；tap 行组=设备面板；已耗尽段入历史折叠区（默认收起，置灰
// 纯查看，复制随块禁用）；末附兜底摘要行（兜底口径同前批）
const SourceCard = memo(({ source, bindings, acting, onSegPress, onSegCopy, onSegUnbind }: {
  source: EntSourceView
  bindings: Record<string, BindingInfo>
  acting: boolean
  onSegPress: (seg: EntSegmentView) => void
  onSegCopy: (key: string) => void
  onSegUnbind: (key: string) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const destructiveColor = theme.isDark ? DESTRUCTIVE_RED.dark : DESTRUCTIVE_RED.light
  const [expanded, setExpanded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const name = APP_CN[source.app] ?? source.app
  const icon = SOURCE_ICONS[source.app]
  const activeSegs = source.segments.filter(s => s.valid)
  const historySegs = source.segments.filter(s => !s.valid)
  // 兜底摘要行（六规则兜底边界口径，2026-11-04 补）：行值含 shiyin 兜底而段列表=
  // 自身键段——兜底更晚时行值>最晚段止，末附一行消解。自身已有永久段=兜底无增量
  // 不显示；行值永久且段列表无永久段=兜底至永久
  const hasPermanentSeg = source.segments.some(s => s.end == 0)
  const segMaxEnd = source.segments.reduce((m, s) => (s.end != 0 && s.end > m ? s.end : m), 0)
  const showFallback = !hasPermanentSeg && (source.expiry == 0 || source.expiry > segMaxEnd)
  const expiryText = source.expiry == 0
    ? t('activation_permanent')
    : `${source.valid ? '' : `${t('activation_state_expired')} · `}${t('activation_until')} ${dateFormat(source.expiry * 1000, 'Y-M-D')}`
  // 段平面行组（子卡改版定稿）：状态三态=state 服务端单源（queued 排队中主色/active
  // 生效中绿/expired 已过期灰；空串/undefined 回落 valid 两态——T4 口径 RN 不自算
  // 时间比较）；行4 兜 seg.valid（state 空串窗口下历史段不误显，审查 I-2）；行内解绑=
  // 正式段+valid+bindings[key] 回填且 mark==null 才显（stale mark 误显收敛为零，
  // 拍板 I-5）；free 兑底命中省徽标（与档位名同词不重复，审查 S-6）
  const SegRow = (seg: EntSegmentView, history: boolean, isLast: boolean) => {
    const binding = bindings[seg.key]
    const queued = seg.state == SEG_STATE.QUEUED
    const expired = !seg.valid || seg.state == SEG_STATE.EXPIRED
    const segName = seg.skuName || (seg.kind == 'free' ? t('ent_kind_free') : t('ent_kind_paid'))
    const showFreeBadge = seg.kind == 'free' && segName != t('ent_kind_free')
    const stateText = expired ? t('activation_state_expired') : queued ? t('ent_state_queued') : t('ent_state_active')
    const stateColor = expired
      ? theme['c-font-label']
      : queued
        ? theme['c-primary']
        : SUCCESS_GREEN[theme.isDark ? 'dark' : 'light']
    const canUnbind = !history && seg.kind == 'paid' && seg.valid && binding != null && binding.mark == null
    const dateStart = seg.start > 0 ? dateFormat(seg.start * 1000, 'Y-M-D') : ''
    const dateEnd = seg.end == 0 ? '' : dateFormat(seg.end * 1000, 'Y-M-D')
    return (
      <View key={seg.key + String(seg.end)} style={[styles.segBlock, history && styles.historySegCard, !isLast && styles.segDivider]}>
        <TouchableOpacity style={styles.segBody} activeOpacity={0.6} disabled={history} onPress={() => { onSegPress(seg) }}>
          <View style={styles.segLine}>
            <Text size={13} color={theme['c-font']} style={styles.segName}>{segName}</Text>
            {showFreeBadge
              ? (
                <Text size={10} color={theme['c-font-label']} style={styles.segBadge}>{t('ent_kind_free')}</Text>
                )
              : null}
            <Text size={11} color={stateColor} style={styles.segState}>{stateText}</Text>
          </View>
          {/* 行2 完整码（tap 复制，历史段随块禁用+selectable 关闭保持纯查看拍板——审查 S-4/S-A） */}
          <TouchableOpacity style={styles.segKeyRow} hitSlop={HIT_SLOP_V} activeOpacity={0.6} disabled={history} onPress={() => { onSegCopy(seg.key) }}>
            <Text size={12} color={theme['c-font-label']} style={styles.segKeyText} selectable={!history}>{seg.key}</Text>
          </TouchableOpacity>
          <Text size={12} color={theme['c-font-label']} style={styles.segTextRow}>
            {queued
              ? (dateStart == ''
                  ? (dateEnd == '' ? t('activation_permanent') : `${t('activation_until')} ${dateEnd}`)
                  : (dateEnd == ''
                      ? t('ent_pending_until_permanent', { start: dateStart })
                      : t('ent_pending_until', { start: dateStart, end: dateEnd })))
              : (dateStart == ''
                  ? (dateEnd == '' ? t('activation_permanent') : `${t('activation_until')} ${dateEnd}`)
                  : `${dateStart} ~ ${dateEnd == '' ? t('activation_permanent') : dateEnd}`)}
          </Text>
          {seg.end != 0 && seg.valid
            ? (
              <Text size={12} color={theme['c-font-label']} style={styles.segTextRow}>
                {t('ent_expire_at', { time: dateFormat(seg.end * 1000, 'h:m:s') })}
              </Text>
              )
            : null}
        </TouchableOpacity>
        {canUnbind
          ? (
            <TouchableOpacity style={styles.segUnbindRow} hitSlop={HIT_SLOP_V} disabled={acting} onPress={() => { onSegUnbind(seg.key) }}>
              <Text size={12} color={destructiveColor}>{t('activation_btn_unbind')}</Text>
            </TouchableOpacity>
            )
          : null}
      </View>
    )
  }
  return (
    <View style={[styles.card, { backgroundColor: theme['c-content-background'], opacity: source.valid ? 1 : 0.55 }]}>
      <TouchableOpacity style={styles.sourceRow} activeOpacity={0.6} onPress={() => { setExpanded(v => !v) }}>
        {icon != null
          ? <Image source={icon} style={styles.sourceIcon} />
          : (
        <Icon name="music" size={20} color={theme['c-primary']} />
            )}
        <Text size={15} style={styles.sourceName} color={theme['c-font']}>{name}</Text>
        <Text size={13} color={source.valid ? theme['c-font'] : theme['c-font-label']}>{expiryText}</Text>
      </TouchableOpacity>
      {expanded
        ? (
          <View style={styles.segList}>
            {activeSegs.map((seg, i) => SegRow(seg, false, i == activeSegs.length - 1))}
            {/* 历史激活码折叠区（六规则③：已耗尽段默认收起，同构置灰纯查看） */}
            {historySegs.length
              ? (
                <>
                  <TouchableOpacity style={styles.historyRow} activeOpacity={0.6} onPress={() => { setHistoryOpen(v => !v) }}>
                    <Text size={12} color={theme['c-font-label']}>
                      {t('ent_history', { n: historySegs.length })} {historyOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {historyOpen ? historySegs.map((seg, i) => SegRow(seg, true, i == historySegs.length - 1)) : null}
                </>
                )
              : null}
            {showFallback
              ? (
                <Text size={11} color={theme['c-font-label']} style={styles.fallbackRow}>
                  {t('ent_fallback_until', { date: source.expiry == 0 ? t('activation_permanent') : dateFormat(source.expiry * 1000, 'Y-M-D') })}
                </Text>
                )
              : null}
          </View>
          )
        : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.s16,
  },
  card: {
    borderRadius: 12,
    padding: SPACING.s16,
    marginTop: SPACING.s12,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
    marginTop: 0,
    padding: SPACING.s16,
  },
  entryLabel: {
    flex: 1,
  },
  emptyTextGroup: {
    flex: 1,
    gap: 2,
  },
  localNotice: {
    marginTop: SPACING.s12,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
  },
  sourceIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  sourceName: {
    flex: 1,
  },
  segList: {
    marginTop: SPACING.s12,
    borderTopWidth: BorderWidths.normal,
    borderTopColor: 'rgba(128,128,128,0.18)',
    paddingTop: SPACING.s12,
    gap: 0,
  },
  // 段平面行组（子卡改版定稿 Q1）：同色无灰底卡，段间细分隔线划界（iOS 分组列表式）
  segBlock: {
    paddingVertical: SPACING.s10,
  },
  segDivider: {
    borderBottomWidth: BorderWidths.normal,
    borderBottomColor: 'rgba(128,128,128,0.18)',
  },
  segBody: {
    gap: 4,
  },
  segLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s8,
  },
  segName: {
    flex: 1,
    fontWeight: 'bold',
  },
  segBadge: {
    borderWidth: BorderWidths.normal,
    borderColor: 'rgba(128,128,128,0.4)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  segState: {
    flexShrink: 0,
  },
  segKeyRow: {
    paddingVertical: 2,
  },
  segKeyText: {
    fontFamily: 'monospace',
  },
  segTextRow: {
    marginTop: -4,
  },
  segUnbindRow: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  historyRow: {
    paddingVertical: 4,
  },
  fallbackRow: {
    paddingVertical: 4,
  },
  historySegCard: {
    opacity: 0.6,
  },
  panelMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  panelMaskTouch: {
    flex: 1,
  },
  panel: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: SPACING.s16,
    paddingBottom: SPACING.s24,
    gap: SPACING.s12,
  },
  panelTitle: {
    fontWeight: 'bold',
  },
  panelActionRow: {
    paddingVertical: 6,
  },
  panelDevices: {
    gap: SPACING.s8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.s8,
  },
  deviceInfo: {
    flex: 1,
  },
  panelUnbindBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  panelCloseBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: BorderWidths.normal,
  },
  rebindBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  rebindText: {
    fontWeight: 'bold',
  },
})
