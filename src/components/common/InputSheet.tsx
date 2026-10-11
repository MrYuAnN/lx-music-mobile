import { forwardRef, useImperativeHandle, useRef, useState, type JSX } from 'react'
import { View } from 'react-native'

import SheetBase, { type SheetBaseType } from './SheetBase'
import Input, { type InputType } from './Input'
import Button from './Button'
import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

// 底部输入弹层（弹窗体系方案 §问题8，参考图1）：标题+输入框+取消/确认，打开即聚焦、键盘协同顶起。
// 新建歌单等单一输入任务的标准容器。
export interface InputSheetProps {
  title: string
  placeholder?: string
  maxLength?: number
  confirmText?: string
  onConfirm?: (text: string) => void
  onHide?: () => void
}

export interface InputSheetType {
  show: () => void
  hide: () => void
  /** 打开并预置文本（清空逻辑由 show 内部处理，预设用于改名类场景） */
  showWithText: (text: string) => void
}

const InputSheet = ({
  title,
  placeholder,
  maxLength,
  confirmText,
  onConfirm,
  onHide,
}: InputSheetProps, ref: React.Ref<InputSheetType>) => {
  const theme = useTheme()
  const t = useI18n()
  const sheetRef = useRef<SheetBaseType>(null)
  const inputRef = useRef<InputType>(null)
  const [text, setText] = useState('')

  const focusInput = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  useImperativeHandle(ref, () => ({
    show() {
      setText('')
      sheetRef.current?.setVisible(true)
      focusInput()
    },
    hide() {
      sheetRef.current?.setVisible(false)
    },
    showWithText(preset: string) {
      setText(preset)
      sheetRef.current?.setVisible(true)
      focusInput()
    },
  }))

  const handleConfirm = () => {
    const name = text.trim()
    if (!name.length) return
    onConfirm?.(name)
  }

  return (
    <SheetBase ref={sheetRef} title={title} onHide={onHide} bgHide={false}>
      <View style={styles.container}>
        <Input
          ref={inputRef}
          style={styles.input}
          value={text}
          placeholder={placeholder}
          maxLength={maxLength}
          onChangeText={setText}
          onSubmitEditing={handleConfirm}
        />
        <View style={styles.btns}>
          <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={() => { sheetRef.current?.setVisible(false) }}>
            <Text size={14} color={theme['c-font']}>{t('cancel')}</Text>
          </Button>
          <Button style={{ ...styles.btn, backgroundColor: theme['c-primary'] }} disabled={!text.trim().length} onPress={handleConfirm}>
            <Text size={14} color={theme['c-on-primary']}>{confirmText ?? t('confirm')}</Text>
          </Button>
        </View>
      </View>
    </SheetBase>
  )
}

const styles = createStyle({
  container: {
    paddingHorizontal: scaleSizeW(20),
    paddingTop: scaleSizeH(6),
    paddingBottom: scaleSizeH(16),
    gap: scaleSizeH(16),
  },
  input: {
    fontSize: 15,
  },
  btns: {
    flexDirection: 'row',
    gap: scaleSizeW(12),
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: scaleSizeH(11),
    paddingBottom: scaleSizeH(11),
    borderRadius: scaleSizeW(10),
  },
})

export default forwardRef(InputSheet) as (p: InputSheetProps & { ref?: React.Ref<InputSheetType> }) => JSX.Element | null
