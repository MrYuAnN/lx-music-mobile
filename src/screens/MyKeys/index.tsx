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
import { onEntitlementChanged, BINDING_MARK, type KeyEntry, type BindingInfo, type EntSourceView, type EntSegmentView } from '@/utils/nativeModules/activation'
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

// 源官方图标（2026-11-04 装机反馈拍板：各音源用官方 logo，圆角矩形渲染；资产=各平台
// iOS 官方 App 图标 512px 落仓，新源上线随源补图）
const SOURCE_ICONS: Record<string, number> = {
  tx: require('@/resources/images/sources/tx.png'),
  wy: require('@/resources/images/sources/wy.png'),
  kg: require('@/resources/images/sources/kg.png'),
  kw: require('@/resources/images/sources/kw.png'),
}

// 码值脱敏中段（段卡行2）：前 5 + … + 后 5，全量码值在段详情面板
const maskKey = (key: string): string => (key.length > 12 ? `${key.slice(0, 5)}…${key.slice(-5)}` : key)

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
  // 行值=max(自身, shiyin 兜底)，段=贡献码单段（start 未知置 0；历史信息本地不可得=空）
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
          skuName: e.isTrial ? t('activation_state_trial') : `…${e.key.slice(-6)}`,
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

  const segLabel = useCallback((seg: EntSegmentView): string => {
    if (seg.skuName) return seg.skuName
    return APP_CN[seg.key.slice(0, 2)] ?? `…${seg.key.slice(-6)}`
  }, [])

  const panelEntry = panelSeg != null ? entries.find(e => e.key == panelSeg.seg.key) : undefined
  const panelMark = panelSeg != null ? (bindings[panelSeg.seg.key]?.mark ?? panelEntry?.mark ?? null) : null
  // 试用/赠送段隐藏解绑（原码卡 trialCard 同口径：服务端 trial_no_release 硬闸，UI 前置）
  const panelHideUnbind = panelEntry?.isTrial == true || panelSeg?.seg.kind == 'free'
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
              onSegPress={seg => { setPanelSeg({ seg, app: src.app }) }}
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

      {/* 段详情面板（拍板：码值复制/秒级到期/设备管理/解绑收段详情） */}
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
                  {panelSeg.seg.skuName || APP_CN[panelSeg.app] || panelSeg.app}
                  {panelSeg.seg.kind == 'free'
                    ? (
                      <Text size={11} color={theme['c-font-label']}>{`  ${t('ent_kind_free')}`}</Text>
                      )
                    : null}
                </Text>
                {/* 码值（tap 复制，原码卡 copyBlock 同交互） */}
                <TouchableOpacity style={styles.panelKeyRow} activeOpacity={0.6} onPress={() => { handleCopy(panelSeg.seg.key) }}>
                  <Text size={14} style={styles.keyText} selectable color={theme['c-font']}>{panelSeg.seg.key}</Text>
                  <Text size={11} color={theme['c-primary']}>{t('keyinfo_copy_hint')}</Text>
                </TouchableOpacity>
                {/* 起~止（日）+ 止于秒级（六规则④：秒级退段详情） */}
                <Text size={13} color={theme['c-font-label']} style={styles.panelLine}>
                  {panelSeg.seg.start > 0 ? `${dateFormat(panelSeg.seg.start * 1000, 'Y-M-D')} ~ ` : ''}
                  {panelSeg.seg.end == 0
                    ? t('activation_permanent')
                    : `${dateFormat(panelSeg.seg.end * 1000, 'Y-M-D')}`}
                </Text>
                {panelSeg.seg.end != 0
                  ? (
                    <Text size={12} color={theme['c-font-label']} style={styles.panelLine}>
                      {t('ent_sec_until', { time: dateFormat(panelSeg.seg.end * 1000, 'h:m:s') })}
                    </Text>
                    )
                  : null}
                {/* 设备管理（原码卡绑定折叠区迁入；远程解绑/绑回链复用） */}
                {panelMark == null || panelMark == BINDING_MARK.OTHER
                  ? (
                    <TouchableOpacity
                      style={styles.panelActionRow}
                      activeOpacity={0.6}
                      onPress={() => { setPanelDevicesOpen(v => !v) }}
                    >
                      <Text size={13} color={theme['c-font-label']}>{t('keyinfo_devices_title')} {panelDevicesOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    )
                  : null}
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
                {/* 解绑（试用/赠送段隐藏；确认链=unbindDevice 内置回落预告） */}
                {!panelHideUnbind && panelMark == null
                  ? (
                    <TouchableOpacity
                      style={styles.unbindSelfBtn}
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

// 按源卡（六规则①②③+装机反馈 2026-11-04）：官方 logo 圆角矩形+源名+行值**同行**；
// 无折叠箭头——整卡点击展开/收起；展开=段三行小卡（老码卡结构化语言：名称+徽标+状态/
// 码值脱敏/起~止），tap 卡开段详情面板；已耗尽段入历史折叠区（默认收起，卡同构置灰）
const SourceCard = memo(({ source, onSegPress }: {
  source: EntSourceView
  onSegPress: (seg: EntSegmentView) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
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
  // 段三行小卡（装机反馈④：老激活码卡结构化语言）：行1=名称+kind 徽标+状态；行2=码值
  // 脱敏；行3=起 ~ 止。tap=段详情面板（拍板：动作不散落列表层）
  const SegMiniCard = (seg: EntSegmentView, history: boolean) => (
    <TouchableOpacity
      key={seg.key + String(seg.end)}
      style={[styles.segCard, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.035)' }, history && styles.historySegCard]}
      activeOpacity={0.6}
      disabled={history}
      onPress={() => { onSegPress(seg) }}
    >
      <View style={styles.segLine}>
        <Text size={13} color={theme['c-font']} style={styles.segName}>{seg.skuName || APP_CN[seg.key.slice(0, 2)] || `…${seg.key.slice(-6)}`}</Text>
        {seg.kind == 'free'
          ? (
            <Text size={10} color={theme['c-font-label']} style={styles.segBadge}>{t('ent_kind_free')}</Text>
            )
            : null}
        <Text size={11} color={seg.valid ? SUCCESS_GREEN[theme.isDark ? 'dark' : 'light'] : theme['c-font-label']} style={styles.segState}>
          {seg.valid ? t('ent_state_active') : t('activation_state_expired')}
        </Text>
      </View>
      <Text size={12} color={theme['c-font-label']} style={styles.segLine}>{maskKey(seg.key)}</Text>
      <Text size={12} color={theme['c-font-label']} style={styles.segLine}>
        {seg.start > 0 ? `${dateFormat(seg.start * 1000, 'Y-M-D')} ~ ` : ''}{seg.end == 0 ? t('activation_permanent') : dateFormat(seg.end * 1000, 'Y-M-D')}
      </Text>
    </TouchableOpacity>
  )
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
            {activeSegs.map(seg => SegMiniCard(seg, false))}
            {/* 历史激活码折叠区（六规则③：已耗尽段默认收起，卡同构置灰纯查看） */}
            {historySegs.length
              ? (
                <>
                  <TouchableOpacity style={styles.historyRow} activeOpacity={0.6} onPress={() => { setHistoryOpen(v => !v) }}>
                    <Text size={12} color={theme['c-font-label']}>
                      {t('ent_history', { n: historySegs.length })} {historyOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {historyOpen ? historySegs.map(seg => SegMiniCard(seg, true)) : null}
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
    gap: SPACING.s8,
  },
  segCard: {
    borderRadius: 10,
    padding: SPACING.s12,
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
  panelKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.s8,
  },
  keyText: {
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  panelLine: {
    marginTop: -4,
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
  unbindSelfBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
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
