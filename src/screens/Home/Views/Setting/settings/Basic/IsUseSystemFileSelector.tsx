import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'


import CheckBoxItem from '../../components/CheckBoxItem'
import { SPACING } from '@/config/spacing'

export default memo(() => {
  const t = useI18n()
  const val = useSettingValue('common.useSystemFileSelector')
  const update = (useSystemFileSelector: boolean) => {
    updateSetting({ 'common.useSystemFileSelector': useSystemFileSelector })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
      check={val}
      label={t('setting_basic_use_system_file_selector')}
      helpDesc={t('setting_basic_use_system_file_selector_tip')}
      onChange={update} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: SPACING.s6,
    // marginBottom: 15,
  },
})
