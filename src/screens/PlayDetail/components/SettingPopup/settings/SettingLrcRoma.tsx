import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import Switch from '@/components/common/Switch'
import { useSettingValue } from '@/store/setting/hook'
import Card from './Card'
import { toggleRoma } from '@/core/lyric'

// 歌词罗马音行（2026-10-21 设置页瘦身迁入：日/韩语音译标注，原播放节设置项；
// toggleRoma 同步播放页歌词与悬浮歌词）
export default memo(() => {
  const t = useI18n()
  const isShowLyricRoma = useSettingValue('player.isShowLyricRoma')
  const setShowLyricRoma = (isShowLyricRoma: boolean) => {
    updateSetting({ 'player.isShowLyricRoma': isShowLyricRoma })
    void toggleRoma(isShowLyricRoma)
  }

  return (
    <Card>
      <TouchableOpacity style={{ flexGrow: 1, flexShrink: 1 }} activeOpacity={0.6} onPress={() => { setShowLyricRoma(!isShowLyricRoma) }}>
        <Text>{t('setting_play_show_roma')}</Text>
      </TouchableOpacity>
      <Switch check={isShowLyricRoma} onChange={setShowLyricRoma} />
    </Card>
  )
})
