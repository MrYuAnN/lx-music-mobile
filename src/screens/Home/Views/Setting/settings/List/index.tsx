import { memo } from 'react'

import SettingSection from '../../components/SettingSection'
import AddMusicLocationType from './AddMusicLocationType'
import IsClickPlayList from './IsClickPlayList'
import IsShowAlbumName from './IsShowAlbumName'
import IsShowInterval from './IsShowInterval'

import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <SettingSection title={t('setting_list')}>
      <IsClickPlayList />
      <IsShowAlbumName />
      <IsShowInterval />
      <AddMusicLocationType />
    </SettingSection>
  )
})
