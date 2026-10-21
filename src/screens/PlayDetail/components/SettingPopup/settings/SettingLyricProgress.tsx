import Text from '@/components/common/Text'
import { View } from 'react-native'

import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import Switch from '@/components/common/Switch'
import Card from './Card'

// 「显示歌词进度」开关行卡（2026-10-20 更多弹层重构：Switch 行——label 左+开关右，业界标准 toggle 形态）
export default () => {
  const t = useI18n()
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')
  const setShowLyricProgressSetting = (showLyricProgressSetting: boolean) => {
    updateSetting({ 'playDetail.isShowLyricProgressSetting': showLyricProgressSetting })
  }

  return (
    <Card>
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text>{t('play_detail_setting_show_lyric_progress_setting')}</Text>
      </View>
      <Switch check={isShowLyricProgressSetting} onChange={setShowLyricProgressSetting} />
    </Card>
  )
}
