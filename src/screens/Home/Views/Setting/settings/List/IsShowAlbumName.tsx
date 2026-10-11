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
  const isShowAlbumName = useSettingValue('list.isShowAlbumName')
  const setShowAlbumName = (isShowAlbumName: boolean) => {
    requestAnimationFrame(() => {
      updateSetting({ 'list.isShowAlbumName': isShowAlbumName })
    })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isShowAlbumName} onChange={setShowAlbumName} label={t('setting_list_show_album_name')} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: SPACING.s6,
    // marginBottom: 15,
  },
})

