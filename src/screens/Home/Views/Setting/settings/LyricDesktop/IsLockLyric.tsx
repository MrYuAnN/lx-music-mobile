import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'


import CheckBoxItem from '../../components/CheckBoxItem'
import { lockDesktopLyric, unlockDesktopLyric } from '@/core/desktopLyric'
import { SPACING } from '@/config/spacing'

export default memo(() => {
  const t = useI18n()
  const isLock = useSettingValue('desktopLyric.isLock')
  // 锁定走含通知权限请求的主链路（审查 I4）；解锁直达
  const setLock = (isLock: boolean) => {
    void (isLock ? lockDesktopLyric() : unlockDesktopLyric()).catch(() => {})
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isLock} onChange={setLock} label={t('setting_lyric_desktop_lock')} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: SPACING.s6,
  },
})
