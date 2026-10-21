import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { useSettingValue } from '@/store/setting/hook'

import SwitchRow from '../../components/SwitchRow'

export default memo(() => {
  const t = useI18n()
  const isShowAlbumName = useSettingValue('list.isShowAlbumName')
  const setShowAlbumName = (isShowAlbumName: boolean) => {
    requestAnimationFrame(() => {
      updateSetting({ 'list.isShowAlbumName': isShowAlbumName })
    })
  }

  return (
    <SwitchRow check={isShowAlbumName} onChange={setShowAlbumName} label={t('setting_list_show_album_name')} />
  )
})

