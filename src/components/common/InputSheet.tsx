import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type JSX } from 'react'
import { Platform, View } from 'react-native'

import SheetBase, { type SheetBaseType } from './SheetBase'
import Input, { type InputType } from './Input'
import Button from './Button'
import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { onDialogImeChange } from '@/utils/nativeModules/utils'

// 底部输入弹层（弹窗体系方案 §问题8，参考图1）：标题+输入框+取消/确认，打开即聚焦、键盘协同顶起。
// 新建歌单等单一输入任务的标准容器。
//
// 键盘避让双轨（2026-10-16 真机定案）：Android 15+（targetSdk 36）e2e 被系统强制，RN Modal 恒
// edge-to-edge——navigationBarTranslucent={false} 被 RN getter 无视、ADJUST_RESIZE 被忽略，
// 改走原生 dialog-ime 事件逐帧抬升（SheetBase avoidKeyboard），sheet 同时垫导航栏 inset；
// Android 14- 上 Modal 非 e2e，navigationBarTranslucent={false} 真实生效、系统 resize 自动
// 顶起（零 JS 参与），sheet 不再垫 bottomInset 防双垫；iOS 走 RN Keyboard + useBottomInset 垫高。
// 点遮罩一次全关为全平台有意拍板（2026-10-17 三席审查 S-K 确认记录；源自「点外部两次才关」反馈的统一语义）。
export interface InputSheetProps {
  title: string
  placeholder?: string
  maxLength?: number
  confirmText?: string
  onConfirm?: (text: string) => void | Promise<void>
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

  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 本会话键盘是否已弹（仅 imeAvoid 有 dialog-ime 信号通道）
  const imeShownRef = useRef(false)
  const imeAvoid = Platform.OS === 'android' && Platform.Version >= 35
  // onShow 时 Dialog 仍 FLAG_NOT_FOCUSABLE，focus 的 IME 请求被吞（真机实证 onShow 直接 focus
  // 不弹——view 已聚焦 RN focus 幂等短路）。双轨（三席审查 #2，iOS/14- 无 ime 信号恒兜底会闪键盘）：
  // 15+：onShow 试一次，300ms 时键盘未弹则 blur+focus 强制重发（300ms 为定延版实证能弹时序），已弹跳过
  // 14-/iOS：维持定延 300ms 聚焦（真机验证可用，无信号可查）
  const focusInput = () => {
    if (!imeAvoid) {
      if (focusTimer.current) clearTimeout(focusTimer.current)
      focusTimer.current = setTimeout(() => {
        focusTimer.current = null
        inputRef.current?.focus()
      }, 300)
      return
    }
    imeShownRef.current = false
    inputRef.current?.focus()
    if (focusTimer.current) clearTimeout(focusTimer.current)
    focusTimer.current = setTimeout(() => {
      focusTimer.current = null
      if (imeShownRef.current) return
      inputRef.current?.blur()
      inputRef.current?.focus()
    }, 300)
  }
  useEffect(() => {
    if (!imeAvoid) return
    return onDialogImeChange(px => { if (px > 0) imeShownRef.current = true })
  }, [imeAvoid])
  useEffect(() => () => {
    if (focusTimer.current) clearTimeout(focusTimer.current)
  }, [])

  // 关闭统一入口（三席审查 S-E）：清聚焦兜底定时器，防 sheet 关闭后定时器对已销毁 Dialog 内
  // input 触发 blur/focus
  const closeSheet = () => {
    if (focusTimer.current) {
      clearTimeout(focusTimer.current)
      focusTimer.current = null
    }
    sheetRef.current?.setVisible(false)
  }

  useImperativeHandle(ref, () => ({
    show() {
      setText('')
      sheetRef.current?.setVisible(true)
    },
    hide() {
      closeSheet()
    },
    showWithText(preset: string) {
      setText(preset)
      sheetRef.current?.setVisible(true)
    },
  }))

  // onConfirm 可能弹出确认框（重名确认）抢焦点收键盘——await 全程置 confirming 挡住
  // onKeyboardDismissed 的自动关，防确认弹窗期间本弹层被误关
  const confirmingRef = useRef(false)
  const handleConfirm = async() => {
    const name = text.trim()
    if (!name.length) return
    confirmingRef.current = true
    try {
      await onConfirm?.(name)
    } finally {
      confirmingRef.current = false
    }
  }

  return (
    // 键盘避让双轨见顶部注释。点遮罩一次全关：键盘弹着时 ROM 消费外部第一击（只收键盘），
    // ime 归 0 回调接续关弹窗。systemAvoidsInsets 仅 Android 14- 为 true（系统 resize 通道），
    // iOS 为 false 走 useBottomInset 垫高（三席审查 #3：此前 iOS 恒 true 致避让失效+进手势条区）
    <SheetBase
      ref={sheetRef}
      title={title}
      onHide={onHide}
      onShow={focusInput}
      onKeyboardDismissed={imeAvoid ? () => { if (!confirmingRef.current) closeSheet() } : undefined}
      navigationBarTranslucent={false}
      systemAvoidsInsets={Platform.OS === 'android' && !imeAvoid}
      avoidKeyboard={imeAvoid}
    >
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
          <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={closeSheet}>
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
