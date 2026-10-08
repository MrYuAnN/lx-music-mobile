import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import CheckBox from '@/components/common/CheckBox'
import { toggleRoma } from '@/core/lyric'
import styles from './style'


export default () => {
  const t = useI18n()
  const isShowLyricRoma = useSettingValue('player.isShowLyricRoma')
  const setShowLyricRoma = (isShow: boolean) => {
    updateSetting({ 'player.isShowLyricRoma': isShow })
    void toggleRoma(isShow)
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.content}>
          <CheckBox marginBottom={3} check={isShowLyricRoma} label={t('setting_play_show_roma')} onChange={setShowLyricRoma} />
        </View>
      </View>
    </View>

  )
}
