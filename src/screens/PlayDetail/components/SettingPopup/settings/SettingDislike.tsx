import { memo, useCallback } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { DESTRUCTIVE_RED } from '@/config/constant'
import { dislikeMusic } from '@/core/player/player'
import Card from './Card'

// 「加入黑名单」动作行（治理批 P5 播放页入口，对标网易云 FM 垃圾桶：拉黑当前歌并自动切下一首，
// dislikeMusic 链路现成；写入经 utils/dislikeManage 转义单点）。
// 2026-10-23 走查反馈二轮修正：从「置底独立动作区」回归「播放」节末尾混排——业界对标成立
// （AM Suggest Less Like This=••• 菜单内混排 / Spotify Don't play this=菜单内红字同规格行，
// 均无「孤立置底区」形态），防误触由菜单交互模型承担（点击即执行+关层）；色值=DESTRUCTIVE_RED
// 语义单源（destructive 红不随 tint，治理批审查 I1）
interface Props {
  onDismiss: () => void
}

const SettingDislike = ({ onDismiss }: Props) => {
  const theme = useTheme()
  const t = useI18n()

  const handlePress = useCallback(() => {
    onDismiss()
    void dislikeMusic().then(() => {
      toast(t('dislike_add_success_tip'))
    })
  }, [t, onDismiss])

  return (
    <Card>
      <TouchableOpacity style={styles.container} activeOpacity={0.6} onPress={handlePress}>
        <Text size={15} color={theme.isDark ? DESTRUCTIVE_RED.dark : DESTRUCTIVE_RED.light}>{t('dislike_play_action')}</Text>
      </TouchableOpacity>
    </Card>
  )
}

const styles = createStyle({
  container: {
    // 触控目标 44dp（design-principles 拍板，同 SettingTimeoutExit 行）
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
})

export default memo(SettingDislike)
