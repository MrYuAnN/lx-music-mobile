import { memo, useCallback } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { dislikeMusic } from '@/core/player/player'

// 「不喜欢这首歌曲」动作行（治理批 P5 播放页入口，对标网易云 FM 垃圾桶：拉黑当前歌并自动切下一首，
// dislikeMusic 链路现成；写入经 utils/dislikeManage 转义单点）
interface Props {
  onDismiss: () => void
}

const SettingDislike = ({ onDismiss }: Props) => {
  const t = useI18n()

  const handlePress = useCallback(() => {
    onDismiss()
    void dislikeMusic().then(() => {
      toast(t('dislike_add_success_tip'))
    })
  }, [t, onDismiss])

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.6} onPress={handlePress}>
      <Text size={15}>{t('dislike_play_action')}</Text>
    </TouchableOpacity>
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
