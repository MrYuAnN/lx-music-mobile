import { memo } from 'react'
import { View, StyleSheet } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'

export default memo(({ onConfirm, onHide, dirOnly }: {
  onConfirm: () => void
  onHide: () => void
  dirOnly: boolean
}) => {
  const t = useI18n()
  const theme = useTheme()

  return (
    // 底色移除（弹窗体系统一方案批2#9）：透出 SheetBase 玻璃/回退实色底
    <View style={styles.footer}>
      <Button style={{ ...styles.footerBtn, width: dirOnly ? '50%' : '100%' }} onPress={onHide}>
        <Text color={theme['c-button-font']}>{t('cancel')}</Text>
      </Button>
      {dirOnly
        ? <Button style={styles.footerBtn} onPress={onConfirm}>
            <Text color={theme['c-button-font']}>{t('confirm')}</Text>
          </Button>
        : null
      }
    </View>
  )
})

const styles = StyleSheet.create({
  footer: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    // borderTopWidth: BorderWidths.normal,
    elevation: 8,
  },
  footerBtn: {
    width: '50%',
    paddingTop: SPACING.s16,
    paddingBottom: SPACING.s16,
    alignItems: 'center',
  },
})
