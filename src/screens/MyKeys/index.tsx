// 「我的激活码」屏（净屏 KeyInfoActivity 对齐，doc/plans/activation-keyinfo-page.md §2.3；
// 批 R 净屏化重构：输码分态〔未购=输码卡直显保真 A-1/A-2/A-3，已购=钥匙入口行→弹窗无 chip
// ——净屏 chip 仅未购态口径，复审 R-I-3〕+码卡净屏式〔label+码值+有效期 date-only（净屏
// app_row 口径，兜底行分钟级）+剩余递进+已绑折叠行默认收起〔默认3，净屏实拍 ▼ 形态推定〕+
// 解绑本机设备红字〕；去杂色终表=R2：4 文字中性+2 钮中性+远程解绑红 destructive 同源）。
// 码卡列表三态：本地 mark 初值+60s/码节流网络刷新（审查 I-2）+按码解绑（I-1）/UNBOUND 一键
// 绑回 rebindKey（I-3：绕过融合编排）+设备列表（n=maxOf(1)〔S-复5〕/本机排前/远程解绑双要素）。
// 关于页激活弹窗已退役（单入口）。2026-11-01 整卡视觉对齐净屏 item_key_card（左对齐/r16 无描
// 边/逐源生效行/绿字绑回/试用码隐藏解绑）+输码弹层迁 InputSheet+全停权码卡放宽渲染（审查 I-4）。
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, TouchableOpacity, View } from 'react-native'
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
import { onEntitlementChanged, BINDING_MARK, type KeyEntry, type BindingInfo } from '@/utils/nativeModules/activation'
import { activationModule } from '@/utils/nativeModules/activation'
import {
  useActivationState,
  activateByCode,
  unbindDevice,
  rebindKey,
  unbindRemoteDevice,
  detectClipboardCandidate,
  formatRemainHint,
  isEntryExpired,
  APP_CN,
} from '@/core/shiyin/activation'
import { sortKeyEntries } from '@/core/shiyin/keyDisplay'

const BINDING_FETCH_INTERVAL = 60 * 1000

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  // 悬浮页头让位（About 同款 headerTotal 管线：内容从玻璃底下穿行）
  const statusBarHeight = useStatusbarHeight()
  const headerTotal = statusBarHeight + SCREEN_HEADER_HEIGHT
  const { info } = useActivationState() // state 消费：未购态判据（审查 I-I：全停权用户也需剪贴板提示）；码列表刷新由下方自身订阅承担
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
  // 在途去重（审查 S9）：动作回刷新与权益事件几乎同时触发时只跑一轮逐码循环；
  // 卸载后中止剩余请求（串行 N 码 × 15s 超时的尾巴）
  const fetchingBindings = useRef(false)
  const mounted = useRef(true)

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

  useEffect(() => {
    refreshEntries()
    return onEntitlementChanged(() => {
      refreshEntries()
    })
  }, [refreshEntries])

  // 配置源到账重渲（2026-11-04 ⑧拍板）：码卡逐源行过滤读 qualityList（applySources 单源），
  // SWR 刷新/首启缓存到账时页内自动收敛（AddMusicScreen 同款订阅模式），不依赖重进页面
  const [sourcesVersion, setSourcesVersion] = useState(0)
  useEffect(() => {
    const handleSourcesUpdated = () => { setSourcesVersion(v => v + 1) }
    global.state_event.on('sourcesUpdated', handleSourcesUpdated)
    return () => { global.state_event.off('sourcesUpdated', handleSourcesUpdated) }
  }, [])

  // 未购态=SDK state 口径（审查 I-I）：全停权（码全带 mark/被清）时 getState 返回 Unactivated，恰是最需要输码的人群；
  // 首帧 info=null（state 异步就绪前）按未购渲染防分态闪烁（代码审查 S-a）
  const unactivated = info == null || info.state == 'unactivated'

  // 码卡两组式排序（方案 §四B Q3 拍板）：T4 收编批件7 抽纯函数 core/shiyin/keyDisplay
  // （node:test 消费，A5 最小版——完整 A5 另立批次），逻辑不变
  const sortedEntries = useMemo(() => sortKeyEntries(entries), [entries])

  // 剪贴板检测（净屏规则，A-1）：仅未购态、进页检测命中显示提示行点击填入——不静默预填；
  // 已购弹窗无检测（净屏 chip 仅未购态口径，复审 R-I-3）
  useEffect(() => {
    setClipCandidate(null)
    if (!unactivated) return
    void Clipboard.getString().then(text => {
      setClipCandidate(detectClipboardCandidate(text))
    }).catch(() => {})
  }, [unactivated])

  const refreshAll = useCallback((forceKey?: string) => {
    refreshEntries(forceKey)
  }, [refreshEntries])

  // 已购态输码弹层（InputSheet 标准容器，净屏激活弹层同形态）：A-3 锁与未购直显卡共用；
  // 成功回调里关层+刷新（InputSheet 自管文本，打开即清空）。busy 态（Q6-B，2026-11-02）：
  // 提交中弹层转圈+禁用+关闭通道全锁（净屏 setCancelable(false) 防误滑丢反馈）；
  // settle 复位+hide/show 内部兜底复位。2026-11-04 统一入口行式后为唯一输码通道
  const handleSheetActivate = useCallback((sheetCode: string) => {
    if (submitting) return
    setSubmitting(true)
    inputSheetRef.current?.setBusy(true)
    void activateByCode(sheetCode, () => {
      inputSheetRef.current?.hide()
      refreshAll()
    }).finally(() => {
      setSubmitting(false)
      inputSheetRef.current?.setBusy(false)
    })
  }, [refreshAll, submitting])

  // 三操作在途锁（审查 I-C：解绑消耗月度配额/远程解绑双要素——防连点重入与确认弹窗
  // 叠开，对齐旧屏 A-3 锁覆盖面）：任一码卡操作在途时禁用全部码卡操作钮
  const [actingKey, setActingKey] = useState<string | null>(null)

  // 动作成功后清该码节流缓存强制重拉（审查 I-A：防 60s 内陈旧 binding 压过新状态）
  const handleUnbind = useCallback((key: string) => {
    if (actingKey != null) return
    setActingKey(key)
    void unbindDevice(key, () => {
      bindingCache.current.delete(key) // 审查 I-2：清节流缓存，防在途逐码轮压回陈旧 binding
      refreshAll(key)
    }).finally(() => { setActingKey(null) })
  }, [actingKey, refreshAll])

  const handleRebind = useCallback((key: string) => {
    if (actingKey != null) return
    setActingKey(key)
    void rebindKey(key, () => {
      bindingCache.current.delete(key) // 审查 I-2：同上——否则绑回成功后码卡滞留 UNBOUND 态
      refreshAll(key)
    }).finally(() => { setActingKey(null) })
  }, [actingKey, refreshAll])

  // 远程解绑成功：清该码节流缓存立即重拉（S-架构2）+连带刷码列表（S-架构3：revoked 码会消失）
  const handleUnbindRemote = useCallback((key: string, deviceId: string) => {
    if (actingKey != null) return
    setActingKey(key)
    void unbindRemoteDevice(key, deviceId, () => {
      bindingCache.current.delete(key)
      refreshAll(key)
    }).finally(() => { setActingKey(null) })
  }, [actingKey, refreshAll])

  // S7：设备区网络失败重试（清节流缓存强拉）——OTHER 态设备数据是换机用户唯一自助解绑路径
  const handleRefreshBinding = useCallback((key: string) => {
    bindingCache.current.delete(key)
    refreshEntries(key)
  }, [refreshEntries])

  const handleCopy = useCallback((key: string) => {
    Clipboard.setString(key)
    hapticSelection() // 净屏 KeyInfoActivity#copyKey 同款触觉反馈（审查 S1）
    toast(t('keyinfo_copied'))
  }, [t])

  // 打开输码弹窗（2026-11-04 统一入口行式）：剪贴板候选存在时预填（showWithText，
  // 弹窗主动打开语境的用户可见填入，取代直显卡 chip「点击填入」）
  const handleOpenInputDialog = useCallback(() => {
    if (clipCandidate) {
      inputSheetRef.current?.showWithText(clipCandidate)
    } else {
      inputSheetRef.current?.show()
    }
  }, [clipCandidate])

  const destructiveColor = theme.isDark ? DESTRUCTIVE_RED.dark : DESTRUCTIVE_RED.light

  return (
    <PageContent>
      <View style={styles.container}>
        <AnimatedScrollView
          contentContainerStyle={[styles.contentContainer, { paddingTop: headerTotal + SPACING.s16 }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* 输码入口（2026-11-04 拍板统一入口行式，推翻批 R D3 两态分形）：已购/未购同构
              入口行→InputSheet 弹窗（busy/空码禁用/防重全套现成，直显卡重复实现整块退役），
              未购文案强化转化；剪贴板候选打开弹窗时预填（弹窗主动打开语境取代直显卡「点击
              填入」chip——A-1 不静默预填口径随语境迁移标注） */}
          <TouchableOpacity
            style={[styles.entryCard, { backgroundColor: theme['c-content-background'] }]}
            activeOpacity={0.6}
            onPress={handleOpenInputDialog}
          >
            <View style={[styles.entryIconBg, { backgroundColor: theme['c-primary-light-900-alpha-200'] }]}>
              <Icon name="key" size={14} color={theme['c-primary']} />
            </View>
            <Text style={styles.entryLabel} size={14}>{unactivated ? t('keyinfo_input_entry_unactivated') : t('keyinfo_input_entry')}</Text>
            <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
          </TouchableOpacity>

          {/* 未购且无码在手：获取激活码引导（批3 v1.2：应用内选购页直达，替换 tutorial.html
              外链——方案 §四批3 入口拍板）；码在手（停权/解绑态）不再引导。
              2026-11-04 结构化重构（用户拍板）：单行轻卡改入口行同构信息卡——图标底+
              标题+副文案（对齐独立售卖模型「按音源独立购买」）+chevron */}
          {unactivated && !entries.length
            ? (
              <TouchableOpacity
                style={[styles.card, styles.entryCard, { backgroundColor: theme['c-content-background'] }]}
                activeOpacity={0.6}
                onPress={() => { pushPurchaseScreen(componentId) }}
              >
                <View style={[styles.entryIconBg, { backgroundColor: theme['c-primary-light-900-alpha-200'] }]}>
                  <Icon name="plus" size={14} color={theme['c-primary']} />
                </View>
                <View style={styles.emptyTextGroup}>
                  <Text size={14} style={styles.entryLabel}>{t('keyinfo_empty_hint')}</Text>
                  <Text size={12} color={theme['c-font-label']}>{t('keyinfo_empty_desc')}</Text>
                </View>
                <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
              </TouchableOpacity>
              )
            : null}
          {/* 生效码卡（2026-11-01 审查 I-4 拍板放宽）：全停权（唯一码 OTHER/unbound→state
              Unactivated）也渲染——OTHER 换机自助远程解绑/UNBOUND 绑回是唯一自助路径，对齐
              净屏码卡常显口径；与输码卡并存不互斥 */}
          {entries.length > 0 && sortedEntries.map(entry => (
            <KeyCard
              key={entry.key}
              entry={entry}
              binding={bindings[entry.key]}
              actionsDisabled={actingKey != null}
              destructiveColor={destructiveColor}
              sourcesVersion={sourcesVersion}
              onRefreshBinding={handleRefreshBinding}
              onCopy={handleCopy}
              onUnbind={handleUnbind}
              onRebind={handleRebind}
              onUnbindRemote={handleUnbindRemote}
            />
          ))}
        </AnimatedScrollView>
        <PlayerBarPlaceholder />
      </View>

      {/* 已购态输码弹层（D3→InputSheet 标准容器，净屏激活弹层同形态）：空码禁用确认钮，
          无剪贴板 chip（净屏 chip 仅未购态，R-I-3） */}
      <InputSheet
        ref={inputSheetRef}
        title={t('setting_activation')}
        placeholder={t('activation_input_hint')}
        confirmText={t('activation_btn_activate')}
        onConfirm={handleSheetActivate}
      />

      <ScreenHeader componentId={componentId} title={t('setting_my_keys')} progress={scrollY} />
    </PageContent>
  )
}

// 码卡（净屏式）：label+码值（点击复制+haptic）+保存提示+到期行（试用标/至 X 分钟级/永久/
// 剩余递进）+三态操作（本机在绑=折叠设备区+红字解绑本机设备；UNBOUND=绑回中性钮；
// OTHER=占用文案+重试，有设备数据直显远程解绑列表）
const KeyCard = memo(({
  entry,
  binding,
  actionsDisabled,
  destructiveColor,
  sourcesVersion,
  onRefreshBinding,
  onCopy,
  onUnbind,
  onRebind,
  onUnbindRemote,
}: {
  entry: KeyEntry
  binding: BindingInfo | undefined
  actionsDisabled: boolean
  destructiveColor: string
  /** 配置源到账重渲触发（代码审查 I-1）：逐源行过滤读 qualityList（非 props），memo 浅
   *  比较不可见——订阅 bump 值作显式 prop 传入，配置 SWR 到账时击穿 memo 重算显示集 */
  sourcesVersion: number
  onRefreshBinding: (key: string) => void
  onCopy: (key: string) => void
  onUnbind: (key: string) => void
  onRebind: (key: string) => void
  onUnbindRemote: (key: string, deviceId: string) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  // 设备列表折叠态（默认3）：仅本机在绑态默认收起；OTHER 态直显（远程解绑=用户主任务）
  const [selfExpanded, setSelfExpanded] = useState(false)
  // 过期码卡整卡置灰（方案 §四B，Q4 拍板）：opacity 弱化≠禁用（复审证伪：不禁触摸，
  // 三态操作钮/复制/设备区全保留可达）；0.55 数值本产品自定（Apple 无透明度记载），
  // 明暗两态可读性真机收口。渲染时计算，跨过期点随重进页收敛（方案 §五登记）
  const expired = isEntryExpired(entry)

  // mark 合流（审查 I-A）：binding.mark 网络值优先但 null=本机在绑是有效值——不得用 ??
  const mark = binding ? binding.mark : entry.mark
  // 设备区可见性（S-PM1/架构6，净屏 KeyInfoActivity:236-238 同口径）：本机在绑或
  // 他机占用且有设备数据才展示；UNBOUND 不展示
  const showDevices = mark == null || (mark == BINDING_MARK.OTHER && (binding?.devices.length ?? 0) > 0)
  const devices = [...(binding?.devices ?? [])].sort((a, b) => (a.isSelf === b.isSelf ? 0 : (a.isSelf ? -1 : 1)))
  const boundCount = Math.max(devices.length, 1) // 服务端 devices 未返回时显示 1 不显 0（S-复5）

  // 生效范围行显示集（2026-11-04 ⑧拍板，取代 2026-11-01「净屏 entitlementRows 对齐」App 侧
  // 口径——净屏维持全集渲染不跟随，跨端分叉=有意决定）：全源键（shiyin）单行；按源收费码
  // 逐源行按 /config 配置源过滤（「配置源=唯一边界」applySources 单源，未启用源键不显示）。
  // 纯展示过滤（判定语义族 T4 收编批退役，真值=bridge validKeys 下发）。S4（审查）：配置未加载（qualityList
  // 空集）不过滤显全集，防首启弱网「全集→过滤集」口径闪变。
  // T4 收编批（2026-11-04）：shiyin 有效性改消费 bridge validKeys 真值（SDK 单源，
  // 原内联时间比较退役；旧桥 null 兜底保留原式）
  const expiryEntries = Object.entries(entry.expiries ?? {})
  const configuredSources = Object.keys(global.sy.qualityList ?? {})
  // 全源键单行条件带有效性（代码审查 I-3）：混合态 {shiyin 过期, 单源键有效} 时若恒收缩
  // 单行，生效码卡唯一行显「已到期」——对齐横幅 pickBannerApp allCovered 同口径（shiyin
  // 有效才收缩，无效回落逐源过滤集）
  const shiyinValid = entry.validKeys?.includes('shiyin')
    ?? expiryEntries.some(([app, exp]) => app == 'shiyin' && exp != 0 && exp * 1000 > Date.now())
  const filteredEntries = shiyinValid
    ? expiryEntries.filter(([app]) => app == 'shiyin')
    : configuredSources.length
      ? expiryEntries.filter(([app]) => configuredSources.includes(app))
      : expiryEntries
  // 字母序恢复（代码审查 I-4）：旧实现渲染前显式排序，过滤分支不得退化为键插入序
  const displayEntries = filteredEntries.sort(([a], [b]) => a.localeCompare(b))
  // 聚合行兜底（⑧）：键集与配置源零交集（过滤后无行）时以摘要行呈现防码卡空白——
  // 条目数+最早到期（永久优先）语义；n 含过期键=兜底低频分支的有意概括口径（代码审查 S-l 登记）
  const renderAggregateRow = () => {
    const anyPermanent = expiryEntries.some(([, exp]) => exp == 0)
    const dates = expiryEntries.filter(([, exp]) => exp != 0).map(([, exp]) => exp)
    const phrase = anyPermanent || dates.length == 0
      ? t('activation_permanent')
      : `${t('activation_until')} ${dateFormat(Math.min(...dates) * 1000, 'Y-M-D')}`
    return `${t('activation_state_n_sources', { n: expiryEntries.length })} · ${phrase}`
  }
  // 逐源行渲染（expiries 键=产品 app 键，APP_CN 映射显示名）；日期口径=净屏 app_row 同款
  // date-only（剩余递进由 remainHint 承担）。状态分态（2026-11-01 用户装机反馈：过期码卡
  // 曾恒显「试用中」；净屏 :445 口径——已到期标签优先于码级档位）。
  // S2（审查）+T4 收编批（2026-11-04）：expired 判定改消费 bridge validKeys 真值
  // （SDK 单源；旧桥 null 兜底保留原式，0=永久语义不变）
  const renderExpiryRow = (app: string, exp: number) => {
    const remain = formatRemainHint(exp, t)
    const expired = !(entry.validKeys?.includes(app) ?? (exp != 0 && exp * 1000 > Date.now()))
    const expiryPhrase = exp == 0
      ? t('activation_permanent')
      : `${expired ? `${t('activation_state_expired')} · ` : entry.isTrial ? `${t('activation_state_trial')} · ` : ''}${t('activation_until')} ${dateFormat(exp * 1000, 'Y-M-D')}${remain ? ` · ${remain}` : ''}`
    return `${APP_CN[app] ?? app} · ${expiryPhrase}`
  }
  // 试用标=码级属性：多源扩表（⑥平台批）时逐行重复口径需复核（DEPLOY.md §8 锚点）
  // 设备行渲染（净屏 makeDeviceRow 单行灰口径）——selfExpanded/OTHER 两分支共用（审查 S5）
  const renderDeviceRows = () => devices.map(d => (
    <View key={d.deviceId} style={styles.deviceRow}>
      <Text size={13} color={theme['c-font-label']} style={styles.deviceInfo}>
        {d.isSelf ? t('keyinfo_device_self') : (d.deviceName || `…${d.deviceId.slice(-6)}`)}{'\u3000'}{dateFormat(d.boundAt * 1000, 'Y-M-D')}
      </Text>
      {!d.isSelf
        ? (
          <TouchableOpacity disabled={actionsDisabled} onPress={() => { onUnbindRemote(entry.key, d.deviceId) }}>
            <Text size={13} color={destructiveColor}>{t('keyinfo_unbind_device')}</Text>
          </TouchableOpacity>
          )
          : null}
    </View>
  ))
  // 旧 native 桥接兜底行用（reload 窗口期）
  const fallbackRemain = formatRemainHint(entry.expiry, t)

  return (
    <View style={[styles.card, { backgroundColor: theme['c-content-background'], opacity: expired ? 0.55 : 1 }]}>
      <Text size={12} color={theme['c-font-label']}>{t('keyinfo_current_key')}</Text>
      <TouchableOpacity style={styles.copyBlock} activeOpacity={0.6} onPress={() => { onCopy(entry.key) }}>
        <Text size={16} style={styles.keyText} selectable>{entry.key}</Text>
        {/* 层次规格=净屏 item_key_card：码 16 等宽加粗/复制提示主题色/生效范围行正文色 15/绑定行 13 灰 */}
        <Text size={12} color={theme['c-primary']} style={styles.hintText}>{t('keyinfo_copy_hint')}</Text>
        {(displayEntries.length
          ? displayEntries.map(([app, exp]) => (
            <Text key={app} size={15} color={theme['c-font']} style={styles.expiryText}>{renderExpiryRow(app, exp)}</Text>
          ))
          : expiryEntries.length
            ? (
              // 聚合行兜底（⑧）：过滤后无行防码卡空白
              <Text size={15} color={theme['c-font']} style={styles.expiryText}>{renderAggregateRow()}</Text>
            )
            : (
            // 旧 native 桥接无 expiries 时的兜底（reload 窗口期）：单值 expiry 行
            // S6（审查）：同步④分态口径——过期加「已到期」标签（净屏 :445 同源）
            // T4 收编批：旧桥兜底分支内联判定保留（isExpiredAt 退役）
            <Text size={15} color={theme['c-font']} style={styles.expiryText}>
              {entry.expiry == 0
                ? t('activation_permanent')
                : `${(entry.expiry != 0 && entry.expiry * 1000 <= Date.now()) ? `${t('activation_state_expired')} · ` : ''}${t('activation_until')} ${dateFormat(entry.expiry * 1000, 'Y-M-D')}${fallbackRemain ? ` · ${fallbackRemain}` : ''}`}
            </Text>
          ))}
      </TouchableOpacity>
      {mark == null
        ? (
          <>
            {showDevices
              ? (
                <TouchableOpacity
                  style={styles.boundRow}
                  activeOpacity={0.6}
                  onPress={() => { setSelfExpanded(v => !v) }}
                >
                  <Text size={13} color={theme['c-font-label']}>
                    {t('keyinfo_devices_title')} · {t('keyinfo_bound_count', { n: boundCount, limit: entry.deviceLimit })} · {t('keyinfo_bound_state_self')}{selfExpanded ? ' ▲' : ' ▼'}
                  </Text>
                </TouchableOpacity>
                )
              : null}
            {selfExpanded
              ? (
                <View style={styles.devices}>{renderDeviceRows()}</View>
                )
              : null}
            {/* 试用码隐藏解绑（净屏 trialCard 同口径：服务端 trial_no_release 硬闸，UI 前置防
                「可转移承诺→确认必 403」自相矛盾；换机走客服） */}
            {!entry.isTrial
              ? (
                <TouchableOpacity
                  style={styles.unbindSelfBtn}
                  disabled={actionsDisabled}
                  onPress={() => { onUnbind(entry.key) }}
                >
                  <Text size={14} color={destructiveColor}>{t('activation_btn_unbind')}</Text>
                </TouchableOpacity>
                )
              : null}
          </>
          )
        : mark == BINDING_MARK.UNBOUND
          ? (
            <View style={styles.keyActions}>
              <Text size={13} color={theme['c-font-label']}>{t('keyinfo_state_unbound')}</Text>
              {/* 绑回钮=净屏 jingpingSuccess 绿字加粗（TextButton 口径，非胶囊） */}
              <TouchableOpacity style={styles.rebindBtn} disabled={actionsDisabled} onPress={() => { onRebind(entry.key) }}>
                <Text size={14} color={SUCCESS_GREEN[theme.isDark ? 'dark' : 'light']} style={styles.rebindText}>{t('keyinfo_bind_this')}</Text>
              </TouchableOpacity>
            </View>
            )
          : (
            <View style={styles.otherRow}>
              <Text size={13} color={theme['c-font-label']}>{t('keyinfo_state_other')}</Text>
              {!(binding?.devices.length)
                ? (
                  <TouchableOpacity disabled={actionsDisabled} onPress={() => { onRefreshBinding(entry.key) }}>
                    <Text size={12}>{t('shiyin_retry')}</Text>
                  </TouchableOpacity>
                  )
                : null}
            </View>
            )}
      {mark == BINDING_MARK.OTHER && showDevices
        ? (
          <View style={styles.devices}>{renderDeviceRows()}</View>
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
    // 卡语言：白卡浮于页面底色；r12=组卡圆角单源（design-principles §4 2026-10-23 拍板，
    // 2026-11-04 全页 r16→r12 收口）
    borderRadius: 12,
    padding: SPACING.s16,
    marginBottom: SPACING.s10,
  },
  // 节头三件套（2026-11-04 精致化）：主色图标+左对齐标题，替换原居中悬空卡标题
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.s12,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  // 节头三件套样式（sectionHeader/sectionTitle）与直显卡专用样式（inputWrap/inputInner/
  // pasteBtn/btn/activateBtnContent/clipChip/cardTitle）已随 2026-11-04 统一入口行式退役
  entryCard: {
    borderRadius: 12,
    padding: SPACING.s16,
    marginBottom: SPACING.s10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
  },
  entryIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryLabel: {
    // 净屏入口行 14sp medium
    flexGrow: 1,
    fontWeight: '500',
  },
  // 空态信息卡文本列（2026-11-04 结构化重构）：标题+副文案纵排，与入口行图标底+chevron 同构
  emptyTextGroup: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 3,
  },
  copyBlock: {
    // 复制热区=上半块（净屏「点击卡片复制」口径：label 下的码+提示+生效范围行整块可点）；
    // 左对齐=净屏竖排 LinearLayout 默认
  },
  keyText: {
    // 净屏 item_key_card 同款：码值等宽+加粗（层级主视觉，区别于灰色辅助文字）
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginTop: SPACING.s4,
  },
  hintText: {
    marginTop: SPACING.s4,
  },
  expiryText: {
    marginTop: SPACING.s6,
  },
  boundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s8,
  },
  devices: {
    marginTop: SPACING.s8,
    paddingTop: SPACING.s8,
    borderTopWidth: BorderWidths.normal,
    gap: SPACING.s8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flex: 1,
  },
  unbindSelfBtn: {
    // 净屏解绑钮同款：全宽红字胶囊（TextButton 36dp r18 口径）
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 18,
    marginTop: SPACING.s8,
  },
  rebindBtn: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.s4,
  },
  rebindText: {
    // 净屏 rebindBtn：绿字加粗（SUCCESS_GREEN 同源 jingpingSuccess）
    fontWeight: 'bold',
  },
  keyActions: {
    gap: SPACING.s8,
  },
  otherRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.s12,
    marginTop: SPACING.s8,
  },
})
