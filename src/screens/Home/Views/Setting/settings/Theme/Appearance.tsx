import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { setTheme } from '@/core/theme'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

// AM 式外观三选一（跟随系统/浅色/深色），替代原 16 套主题选择器
const OPTIONS = [
  { id: 'auto', langKey: 'theme_appearance_auto' },
  { id: 'am_light', langKey: 'theme_appearance_light' },
  { id: 'am_dark', langKey: 'theme_appearance_dark' },
] as const

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const themeId = useSettingValue('theme.id')

  return (
    <SubTitle title={t('setting_basic_theme_appearance')}>
      <View style={styles.list}>
        {
          OPTIONS.map(({ id, langKey }) => {
            const isActive = themeId == id
            return (
              <TouchableOpacity
                key={id}
                style={{
                  ...styles.item,
                  backgroundColor: isActive ? theme['c-primary-background'] : theme['c-content-background'],
                  borderColor: isActive ? theme['c-primary'] : theme['c-border-background'],
                }}
                activeOpacity={0.5}
                onPress={() => { setTheme(id) }}
              >
                <Text size={13} color={isActive ? theme['c-primary-font'] : theme['c-font']}>{t(langKey)}</Text>
              </TouchableOpacity>
            )
          })
        }
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 5,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.2,
  },
})
