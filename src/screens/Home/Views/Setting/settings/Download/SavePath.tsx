import { memo } from 'react'

import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { DEFAULT_SAVE_PATH } from '@/core/music/download'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const savePath = useSettingValue('download.savePath')

  return (
    <View style={styles.content}>
      <Text size={12} color={theme['c-font-label']} numberOfLines={2}>{savePath || DEFAULT_SAVE_PATH}</Text>
      <Text size={12} color={theme['c-font-label']}>{t('setting_download_save_path_tip')}</Text>
    </View>
  )
})

const styles = {
  content: {
    gap: 4,
    paddingBottom: 8,
  },
}
