import { forwardRef, useImperativeHandle, useRef } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import Dialog, { type DialogType } from './Dialog'
import Button from './Button'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang/index'
import { useTheme } from '@/store/theme/hook'
import Text, { FontFamilies } from './Text'
import { SPACING } from '@/config/spacing'

const styles = createStyle({
  main: {
    // flexGrow: 0,
    flexShrink: 1,
    marginTop: SPACING.s16,
    marginLeft: SPACING.s6,
    marginRight: SPACING.s6,
    marginBottom: SPACING.s16,
  },
  content: {
    flexGrow: 0,
    paddingLeft: SPACING.s10,
    paddingRight: SPACING.s10,
  },
  // iOS Alert 式按钮区：顶部发丝线分隔、文本按钮等宽并排（弹窗体系方案 §问题8）
  btns: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnsReversedDirection: {
    flexDirection: 'row-reverse',
  },
  btn: {
    flex: 1,
    paddingTop: SPACING.s12,
    paddingBottom: SPACING.s12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
  },
  btnTextBold: {
    fontFamily: FontFamilies.bold,
  },
})

export interface ConfirmAlertProps {
  onCancel?: () => void
  onHide?: () => void
  onConfirm?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  text?: string
  cancelText?: string
  confirmText?: string
  showConfirm?: boolean
  disabledConfirm?: boolean
  reverseBtn?: boolean
  children?: React.ReactNode | React.ReactNode[]
}

export interface ConfirmAlertType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<ConfirmAlertType, ConfirmAlertProps>(({
  onHide,
  onCancel,
  onConfirm = () => {},
  keyHide,
  bgHide,
  closeBtn,
  title = '',
  text = '',
  cancelText = '',
  confirmText = '',
  showConfirm = true,
  disabledConfirm = false,
  children,
  reverseBtn = false,
}: ConfirmAlertProps, ref) => {
  const theme = useTheme()
  const t = useI18n()

  const dialogRef = useRef<DialogType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      dialogRef.current?.setVisible(visible)
    },
  }))

  const handleCancel = () => {
    onCancel?.()
    dialogRef.current?.setVisible(false)
  }

  return (
    <Dialog onHide={onHide} keyHide={keyHide} bgHide={bgHide} closeBtn={closeBtn} title={title} ref={dialogRef}>
      <View style={styles.main}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
          {children ?? <Text>{text}</Text>}
        </ScrollView>
      </View>
      <View style={{ ...styles.btns, borderTopColor: theme['c-border-background'], ...(reverseBtn ? styles.btnsReversedDirection : null) }}>
        <Button style={styles.btn} onPress={handleCancel}>
          <Text size={15} color={theme['c-font']}>{cancelText || t('cancel')}</Text>
        </Button>
        {showConfirm
          ? (
              <>
                <View style={{ ...styles.separator, backgroundColor: theme['c-border-background'] }} />
                <Button style={styles.btn} onPress={onConfirm} disabled={disabledConfirm}>
                  <Text size={15} color={theme['c-primary']} style={styles.btnTextBold}>{confirmText || t('confirm')}</Text>
                </Button>
              </>
            )
          : null}
      </View>
    </Dialog>
  )
})
