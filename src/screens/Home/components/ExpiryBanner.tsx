import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { SPACING } from '@/config/spacing'
import { dateFormat } from '@/utils'
import { pushPurchaseScreen } from '@/navigation/navigation'
import { useActivationState, isExpiringSoonAt } from '@/core/shiyin/activation'
import type { ActivationStateInfo } from '@/utils/nativeModules/activation'

// Home 顶部到期警示横幅（2026-11-01 用户拍板，对齐净屏「打开即见」交互：净屏=卡片状态行
// +30s tick+事件驱动双刷，拾音对应物=首页横幅）。两态：即将到期（≤3 天，金）/已到期（红），
// 点击直达选购页（批3 v1.2：续费动线一步到位，原 MyKeys 两跳改直跳）。无到期概念（未激活/永久）不渲染。
// 多源归因（2026-11-01 用户多源提示需求；净屏审查 I8 口径=「文案按最早到期 app 归因——
// per-app 混合权益不失真」）：bridge getState 下发 expiries 全集。2026-11-03 语义修正
// （方案 activation-expiry-display-plan.md）：有任一生效权益不出「已到期」红横幅（Q2 拍板，
// 混合态不打全局红灯）；过期键被有效 shiyin 全源键兜底遮蔽不提醒；金临期保留（滤红留金），
// 红仅在全部权益失效时按最早过期源归因。详情码卡页逐源可见。
// 配色=HIG 语义色硬编码（主题无 warning/error token，明暗两态均可读；后续主题扩 token 时收编）
// S8 时区注（审查）：dateText 走 dateFormat（设备本地时区）——与 remainHint 的 Asia/Shanghai
// 口径在海外机可能差一天；横幅仅日期表述无天差计算，偏差知情接受（remainHint 天差才需固定时区）

// HIG systemOrange / systemRed（明暗通用语义色）
const BANNER_COLORS = {
  warning: 'rgb(255, 149, 10)',
  danger: 'rgb(255, 59, 48)',
} as const

interface BannerPick {
  exp: number
  expired: boolean
}

/** 归因（方案 activation-expiry-display-plan.md §四A 滤红留金口径，2026-11-03 审查 C-1 修订）：
 *  T4 收编批（2026-11-04）真值消费：pool=bridge 下发 masked 遮蔽视图（SDK maskApps
 *  单源——shiyin 兜底有效时只留 shiyin 键，原 allCovered 收缩语义恒等）；每键真值=
 *  bridge valid（SDK validAt 单源，原内联时间比较退役）；hasAnyValid（任一键有效）=
 *  混合态红不出（Q2 拍板：有生效码不打全局红灯，过期源续费触点=播放弹窗），滤红留金
 *  只挑最早临期键；全失效→红显最早过期键。旧桥窗口（valid/masked 缺失）不渲染横幅。
 *  组合边界复审已推演：{F,T} 不可达（hasAnyValid 真时红被滤），无死路 */
const pickBannerApp = (info: ActivationStateInfo): BannerPick | null => {
  if (info.expiries == null || info.valid == null || info.masked == null) return null
  const pool = Object.entries(info.masked)
  const hasAnyValid = Object.values(info.valid).some(Boolean)
  let pick: BannerPick | null = null
  for (const [app, exp] of pool) {
    if (exp == 0) continue // 永久不提醒
    const expired = info.valid[app] !== true
    const soon = !expired && isExpiringSoonAt(exp, true)
    // 滤红留金：有任一生效权益时过期键不参与（红色全局横幅只在全失效态出现）
    if (expired && hasAnyValid) continue
    if (!expired && !soon) continue
    if (pick == null || (expired && !pick.expired) || (expired == pick.expired && exp < pick.exp)) {
      pick = { exp, expired }
    }
  }
  return pick
}

/** 临期文案三档粒度（2026-11-03 用户需求）：剩余<1h=分钟倒计时、<24h=小时倒计时、
 *  1-3 天=日期（此前恒日期粒度，当天到期只显日期不显紧迫度）。分粒度
 *  语义与 KeyInfo keyinfo_remain 对齐；30s tick 现成=倒计时分钟级自动刷新。
 *  2026-11-04 ⑫B 拍板精简：去源归因（详情码卡页可见，11-01 归因展示退役）、1-3 天档
 *  去时分与「即将」字样（'M-D' 短日期，3 天窗内无跨年歧义）——单行不再拥挤 */
const bannerLabel = (pick: BannerPick): string => {
  if (pick.expired) return global.i18n.t('home_banner_expired')
  const remainSec = pick.exp - Date.now() / 1000
  if (remainSec < 3600) {
    const minutes = Math.max(1, Math.ceil(remainSec / 60))
    return global.i18n.t('home_banner_expiring_minutes', { n: minutes })
  }
  if (remainSec < 86400) {
    const hours = Math.max(1, Math.ceil(remainSec / 3600))
    return global.i18n.t('home_banner_expiring_hours', { n: hours })
  }
  return global.i18n.t('home_banner_expiring', { date: dateFormat(pick.exp * 1000, 'M-D') })
}

export default () => {
  const theme = useTheme()
  const { info } = useActivationState()
  // 30s tick 对齐净屏 refreshTick：剩余窗跨档（如 3 天→不足 3 天）无需权益事件也自动收敛；
  // 只 set 不读（翻转值变更即触发重渲染，mode 每次渲染按 Date.now() 重算）。
  // 代码审查 I-1（2026-11-03）：原恒 set(true) 被 useState 同值短路，tick 第二轮起 no-op——
  // 改翻转（v => !v）恢复跨档自动收敛。
  // S9（审查）：横幅不可见态停表——绝大多数用户（未激活/永久/远期）零空转
  const [, setHasTick] = useState(false)
  useEffect(() => {
    const active = info != null && pickBannerApp(info) != null
    setHasTick(active)
    if (!active) return
    const timer = setInterval(() => { setHasTick(v => !v) }, 30_000)
    return () => { clearInterval(timer) }
  }, [info])

  const pick = info != null ? pickBannerApp(info) : null
  if (pick == null || info == null) return null
  const label = bannerLabel(pick)

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.banner, { backgroundColor: theme['c-content-background'] }]}
      onPress={() => { pushPurchaseScreen('') }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.dot, { backgroundColor: BANNER_COLORS[pick.expired ? 'danger' : 'warning'] }]} />
      <Text size={13} color={BANNER_COLORS[pick.expired ? 'danger' : 'warning']} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s8,
    paddingVertical: SPACING.s10,
    paddingHorizontal: SPACING.s12,
    borderRadius: 10,
    gap: SPACING.s8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
