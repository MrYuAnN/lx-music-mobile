import { memo } from 'react'

import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import { useI18n } from '@/lang/i18n'
import Quality from './Quality'
import SavePath from './SavePath'

export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_download')}>
      <SubTitle title={t('setting_download_quality')}>
        <Quality />
      </SubTitle>
      <SubTitle title={t('setting_download_save_path')}>
        <SavePath />
      </SubTitle>
    </Section>
  )
})
