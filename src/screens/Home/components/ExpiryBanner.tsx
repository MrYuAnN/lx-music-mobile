import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { SPACING } from '@/config/spacing'
import { dateFormat } from '@/utils'
import { pushPurchaseScreen } from '@/navigation/navigation'
import { useActivationState, APP_CN, isExpiredAt, isExpiringSoonAt } from '@/core/shiyin/activation'
import type { ActivationStateInfo } from '@/utils/nativeModules/activation'

// Home 顶部到期警示横幅（2026-11-01 用户拍板，对齐净屏「打开即见」交互：净屏=卡片状态行
// +30s tick+事件驱动双刷，拾音对应物=首页横幅）。两态：即将到期（≤3 天，金）/已到期（红），
// 点击直达选购页（批3 v1.2：续费动线一步到位，原 MyKeys 两跳改直跳）。无到期概念（未激活/永久）不渲染。
// 多源归因（2026-11-01 用户多源提示需求；净屏审查 I8 口径=「文案按最早到期 app 归因——
// per-app 混合权益不失真」）：bridge getState 下发 expiries 全集，横幅取「过期源优先、
// 其次最早临期」单归因显示 {app}会员；全部同窗时用户续费最早源即可，详情码卡页逐源可见。
// 配色=HIG 语义色硬编码（主题无 warning/error token，明暗两态均可读；后续主题扩 token 时收编）
// S8 时区注（审查）：dateText 走 dateFormat（设备本地时区）——与 remainHint 的 Asia/Shanghai
// 口径在海外机可能差一天；横幅仅日期表述无天差计算，偏差知情接受（remainHint 天差才需固定时区）

// HIG systemOrange / systemRed（明暗通用语义色）
const BANNER_COLORS = {
  warning: 'rgb(255, 149, 10)',
  danger: 'rgb(255, 59, 48)',
} as const

interface BannerPick {
  app: string
  exp: number
  expired: boolean
}

/** 归因：per-app expiries 全集中「过期源优先、其次最早临期（≤3 天）」；无命中=null */
const pickBannerApp = (info: ActivationStateInfo): BannerPick | null => {
  if (info.expiries == null) return null
  let pick: BannerPick | null = null
  for (const [app, exp] of Object.entries(info.expiries)) {
    if (exp == 0) continue // 永久不提醒
    const expired = isExpiredAt(exp)
    const soon = !expired && isExpiringSoonAt(exp)
    if (!expired && !soon) continue
    if (pick == null || (expired && !pick.expired) || (expired == pick.expired && exp < pick.exp)) {
      pick = { app, exp, expired }
    }
  }
  return pick
}

/** 临期文案三档粒度（2026-11-03 用户需求）：剩余<1h=分钟倒计时、<24h=小时倒计时、
 *  1-3 天=日期+具体时间点（此前恒日期粒度，当天到期只显日期不显紧迫度）。分粒度
 *  语义与 KeyInfo keyinfo_remain 对齐；30s tick 现成=倒计时分钟级自动刷新 */
const bannerLabel = (pick: BannerPick, appName: string): string => {
  if (pick.expired) return global.i18n.t('home_banner_expired', { app: appName })
  const remainSec = pick.exp - Date.now() / 1000
  if (remainSec < 3600) {
    const minutes = Math.max(1, Math.ceil(remainSec / 60))
    return global.i18n.t('home_banner_expiring_minutes', { app: appName, n: minutes })
  }
  if (remainSec < 86400) {
    const hours = Math.max(1, Math.ceil(remainSec / 3600))
    return global.i18n.t('home_banner_expiring_hours', { app: appName, n: hours })
  }
  return global.i18n.t('home_banner_expiring', {
    app: appName,
    date: dateFormat(pick.exp * 1000, 'Y-M-D h:m'),
  })
}

export default () => {
  const theme = useTheme()
  const { info } = useActivationState()
  // 30s tick 对齐净屏 refreshTick：剩余窗跨档（如 3 天→不足 3 天）无需权益事件也自动收敛；
  // 只 set 不读（setTick 变更即触发重渲染，mode 每次渲染按 Date.now() 重算）。
  // S9（审查）：横幅不可见态停表——绝大多数用户（未激活/永久/远期）零空转
  const [, setHasTick] = useState(false)
  useEffect(() => {
    const active = info != null && pickBannerApp(info) != null
    setHasTick(active)
    if (!active) return
    const timer = setInterval(() => { setHasTick(true) }, 30_000)
    return () => { clearInterval(timer) }
  }, [info])

  const pick = info != null ? pickBannerApp(info) : null
  if (pick == null || info == null) return null
  const appName = APP_CN[pick.app] ?? pick.app
  const label = bannerLabel(pick, appName)

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
