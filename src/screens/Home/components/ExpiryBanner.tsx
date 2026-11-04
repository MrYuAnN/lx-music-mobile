import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { SPACING } from '@/config/spacing'
import { dateFormat } from '@/utils'
import { pushPurchaseScreen } from '@/navigation/navigation'
import { useI18n } from '@/lang'
import { useActivationState } from '@/core/shiyin/activation'
import { pickBannerApp, bannerLabel } from '@/core/shiyin/keyDisplay'

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

// 归因 pickBannerApp（滤红留金）/文案 bannerLabel 三档粒度/BannerPick 类型：单源
// keyDisplay.ts（A5 批平移，2026-11-05；t/dateFormat 由本组件调用点注入，行为不变）

export default () => {
  const theme = useTheme()
  const t = useI18n()
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
  const label = bannerLabel(pick, t, dateFormat)

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
