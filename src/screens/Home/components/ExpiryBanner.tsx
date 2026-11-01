import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { SPACING } from '@/config/spacing'
import { dateFormat } from '@/utils'
import { pushMyKeysScreen } from '@/navigation/navigation'
import { useActivationState } from '@/core/shiyin/activation'
import type { ActivationStateInfo } from '@/utils/nativeModules/activation'

// Home 顶部到期警示横幅（2026-11-01 用户拍板，对齐净屏「打开即见」交互：净屏=卡片状态行
// +30s tick+事件驱动双刷，拾音对应物=首页横幅）。两态：即将到期（≤3 天，金）/已到期（红），
// 点击直达我的激活码。无到期概念（未激活/永久）不渲染。
// 配色=HIG 语义色硬编码（主题无 warning/error token，明暗两态均可读；后续主题扩 token 时收编）

// HIG systemOrange / systemRed（明暗通用语义色）
const BANNER_COLORS = {
  warning: 'rgb(255, 149, 10)',
  danger: 'rgb(255, 59, 48)',
} as const

/** Active 且最早到期落窗（≤3 天）/Expired → 横幅状态；其余（未激活/永久/远期）= null */
const bannerState = (info: ActivationStateInfo | null): 'warning' | 'danger' | null => {
  if (info == null) return null
  if (info.state == 'expired') return 'danger'
  if (info.state != 'active') return null
  if (info.expiry == null || info.expiry == 0) return null // 永久/无记录
  const remainSec = info.expiry - Math.floor(Date.now() / 1000)
  return remainSec <= 3 * 86400 ? 'warning' : null
}

export default () => {
  const theme = useTheme()
  const { info } = useActivationState()

  // 30s tick 对齐净屏 refreshTick：剩余窗跨档（如 3 天→不足 3 天）无需权益事件也自动收敛；
  // 只 set 不读（setTick 变更即触发重渲染，mode 每次渲染按 Date.now() 重算）
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => { setTick(v => v + 1) }, 30_000)
    return () => { clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 稳定 setter，挂载一次
  }, [])

  const mode = bannerState(info)

  if (mode == null || info == null) return null
  const isDanger = mode == 'danger'
  const dateText = info.expiry != null && info.expiry != 0 ? dateFormat(info.expiry * 1000, 'Y-M-D') : ''
  const label = isDanger
    ? global.i18n.t('home_banner_expired', { date: dateText })
    : global.i18n.t('home_banner_expiring', { date: dateText })

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.banner, { backgroundColor: theme['c-content-background'] }]}
      onPress={() => { pushMyKeysScreen('') }}
    >
      <View style={[styles.dot, { backgroundColor: BANNER_COLORS[mode] }]} />
      <Text size={13} color={BANNER_COLORS[mode]} numberOfLines={1}>{label}</Text>
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
