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
// 扩展 props（弹窗体系统一方案批2#6，审查轮 I-3 拍板清单，均 optional 零影响既有消费方）：
// description=输入框上方状态副文案位；extra=输入框下方内容 slot（复选框类）；cancelText=动态
// 取消文案（空串回退默认「取消」）；onCancel=取消钮业务回调（与关闭分流：closeSheet 先行，
// 回调随后——对齐原生关窗后跑 onPress 时序）
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
  cancelText?: string
  description?: React.ReactNode
  extra?: React.ReactNode
  onCancel?: () => void
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
  cancelText,
  description,
  extra,
  onCancel,
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

  // 分区语义+空表单即关（2026-10-19 终版）：本 ROM 键盘弹着时把输入框外所有第一击在窗口层
  // 征用去收键盘（onPressIn 实验证伪「按钮位移取消按压」论——动作挂触点仍不执行，touch 确实
  // 进不了 RN），app 只知「键盘收起」不知落点，接续关层按「有无草稿」分流：无草稿（确认键必
  // 为禁用态，首击无论落在遮罩/空白/取消都只能是放弃意图）随 ime 收起立即同帧关层，遮罩一击
  // 全关回归；有草稿一律不联动——被吃后取消与确认不可分辨，自动提交会令「点取消」变「建单」，
  // 自动关层会丢草稿，二击按分区语义执行。创建主路径=输入法「完成」键直提（IME 内部按键
  // 事件不经屏幕触摸）；确认/取消动作挂 onPressIn（键盘收起态第二击触点即执行）。
  // 时点说明（三席审查 S-14）：UtilsModule 已挂 KeyboardPassThroughCallback——首击自收键盘
  // +放行，正常 ROM 上全部操作一击完成；本处二击/分流语义为放行件缺失 ROM 的兜底
  const handleImeDismiss = () => {
    if (!text.trim().length) closeSheet()
  }
  const handleConfirm = async() => {
    const name = text.trim()
    if (!name.length) return
    try {
      await onConfirm?.(name)
    } catch {
      // 通用组件兜底（三席审查 S-5）：调用方应自行容错，此处防未捕获拒绝冒泡
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
      onKeyboardDismissed={imeAvoid ? handleImeDismiss : undefined}
      navigationBarTranslucent={false}
      systemAvoidsInsets={Platform.OS === 'android' && !imeAvoid}
      avoidKeyboard={imeAvoid}
    >
      <View style={styles.container}>
        {description ? <View style={styles.description}>{description}</View> : null}
        <Input
          ref={inputRef}
          style={styles.input}
          value={text}
          placeholder={placeholder}
          maxLength={maxLength}
          returnKeyType="done"
          onChangeText={setText}
          onSubmitEditing={handleConfirm}
        />
        {extra ? <View style={styles.extra}>{extra}</View> : null}
        <View style={styles.btns}>
          {/* 动作挂 onPressIn（触点即触发）而非 onPress（抬手触发）：本 ROM 键盘弹着时任意首触
              会并发触发 IME 收起，imeAnim 随之逐帧下移弹层——抬手前按钮已滑出指下，Pressable 判定
              触摸移出命中区取消按压，onPress 永不执行（真机「点确认只关键盘、要点两次」根因，
              2026-10-19）。下触即执行后键盘收起与弹窗关闭同帧启动，一气呵成；代价=按住滑出按钮
              不再视为取消（对话框双键场景可接受） */}
          <Button
            style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }}
            onPressIn={() => {
              closeSheet()
              onCancel?.()
            }}
          >
            <Text size={14} color={theme['c-font']}>{cancelText || t('cancel')}</Text>
          </Button>
          <Button
            style={{ ...styles.btn, backgroundColor: theme['c-primary'] }}
            disabled={!text.trim().length}
            onPressIn={handleConfirm}
          >
            {/* 空串同样回退默认文案（|| 非 ??）：动态文案消费方（定时关闭）在未开启态传空串，
                ?? 会让确认钮白底无字（真机反馈 2026-10-21） */}
            <Text size={14} color={theme['c-on-primary']}>{confirmText || t('confirm')}</Text>
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
  // slot 与标题/输入框的贴靠由容器单源补偿（审查优 S-1：消费方零 margin 联动）
  description: {
    marginTop: scaleSizeH(-6),
  },
  extra: {
    marginTop: scaleSizeH(-6),
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
