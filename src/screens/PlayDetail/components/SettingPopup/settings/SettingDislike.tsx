import { memo, useCallback } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { dislikeMusic } from '@/core/player/player'
import Card from './Card'

// 「加入黑名单」动作行（治理批 P5 播放页入口，对标网易云 FM 垃圾桶：拉黑当前歌并自动切下一首，
// dislikeMusic 链路现成；写入经 utils/dislikeManage 转义单点）。
// 2026-10-23 走查反馈：从「播放」节移至弹层末尾独立动作区+主色红字（destructive 置底惯例，
// 同 Spotify「Don't play this」歌曲菜单置底）——与定时/倍速等有状态设置项视觉分区防误触；
// 包 Card 补齐 FORM_ROW_PADDING（原裸行缺内边距顶左缘）
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
        <Text size={15} color={theme['c-primary']}>{t('dislike_play_action')}</Text>
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
