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
  // 纯文本正文居中（拍板#3 iOS Alert 式）；children 表单场景左对齐（编辑歌单 AM 同构）
  message: {
    textAlign: 'center',
  },
  // iOS Alert 式按钮区：顶部发丝线分隔、文本按钮等宽并排（弹窗体系方案 §问题8）
  btns: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnsReversedDirection: {
    flexDirection: 'row-reverse',
  },
  // 三按钮竖排（HIG Alerts stack 规格，弹窗体系统一方案批1 审查 I-1；顺序审查 I-3 拍板 iOS
  // 惯例）：column-reverse 使 JSX 首位的 cancel 渲染在底部（iOS cancel 恒底）、confirm 置顶——
  // 视觉序=confirm/neutral/cancel，与双钮 row 的 cancel 左 confirm 右共存不冲突
  btnsStacked: {
    flexDirection: 'column-reverse',
  },
  btn: {
    flex: 1,
    paddingTop: SPACING.s12,
    paddingBottom: SPACING.s12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  // 竖排下按钮高度=内容高（不纵向均分）
  btnStacked: {
    flex: 0,
    paddingHorizontal: SPACING.s10,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
  },
  stackedSeparator: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
  },
  btnTextBold: {
    fontFamily: FontFamilies.bold,
  },
})

export interface ConfirmAlertProps {
  onCancel?: () => void
  onNeutral?: () => void
  onHide?: () => void
  onConfirm?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  text?: string
  cancelText?: string
  neutralText?: string
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
  onNeutral,
  onConfirm = () => {},
  keyHide,
  bgHide,
  closeBtn,
  title = '',
  text = '',
  cancelText = '',
  neutralText,
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

  // 三钮形态（HIG 竖排）：neutralText+onNeutral 同时传入才生效，默认双钮路径零影响
  const stacked = neutralText != null && onNeutral != null
  const btnStyle = stacked ? { ...styles.btn, ...styles.btnStacked } : styles.btn
  const stackedSeparatorStyle = { ...styles.stackedSeparator, backgroundColor: theme['c-border-background'] }

  return (
    <Dialog onHide={onHide} keyHide={keyHide} bgHide={bgHide} closeBtn={closeBtn} title={title} ref={dialogRef}>
      <View style={styles.main}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'} showsVerticalScrollIndicator={false}>
          {children ?? <Text style={styles.message}>{text}</Text>}
        </ScrollView>
      </View>
      <View style={{ ...styles.btns, borderTopColor: theme['c-border-background'], ...(stacked ? styles.btnsStacked : (reverseBtn ? styles.btnsReversedDirection : null)) }}>
        {/* stacked 与 reverseBtn 互斥（审查 S-4）：竖排序语义由 column-reverse 单源承担，同传时 stacked 优先 */}
        <Button style={btnStyle} onPress={handleCancel}>
          <Text size={15} color={theme['c-font']}>{cancelText || t('cancel')}</Text>
        </Button>
        {stacked
          ? (
              <>
                <View style={stackedSeparatorStyle} />
                <Button style={btnStyle} onPress={onNeutral}>
                  <Text size={15} color={theme['c-font']}>{neutralText}</Text>
                </Button>
              </>
            )
          : null}
        {showConfirm
          ? (
              <>
                <View style={stacked ? stackedSeparatorStyle : { ...styles.separator, backgroundColor: theme['c-border-background'] }} />
                <Button style={btnStyle} onPress={onConfirm} disabled={disabledConfirm}>
                  <Text size={15} color={theme['c-primary']} style={styles.btnTextBold}>{confirmText || t('confirm')}</Text>
                </Button>
              </>
            )
          : null}
      </View>
    </Dialog>
  )
})
