import { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react'
import Text from '@/components/common/Text'
import { View } from 'react-native'
import InputSheet, { type InputSheetType } from '@/components/common/InputSheet'
import { toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { cancelTimeoutExit, getTimeoutExitTime, onTimeUpdate, startTimeoutExit, stopTimeoutExit, useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { useI18n } from '@/lang'
import CheckBox from './common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'

const MAX_MIN = 1440
const rxp = /([1-9]\d*)/
// 倒计时格式化单源（播放页更多弹层「定时关闭」入口行复用）
export const formatTime = (time: number) => {
  let h = Math.trunc(time / 3600)
  let hStr = h ? h.toString() + ':' : ''
  time = time % 3600
  const m = Math.trunc(time / 60).toString().padStart(2, '0')
  const s = Math.trunc(time % 60).toString().padStart(2, '0')
  return `${hStr}${m}:${s}`
}
// 状态副文案（InputSheet description 位，弹窗体系统一方案批2#6）：关闭态提示/开启倒计时/等待播完
const Status = () => {
  const theme = useTheme()
  const t = useI18n()
  const exitTimeInfo = useTimeoutExitTimeInfo()
  return (
    <View>
      {
      exitTimeInfo.time < 0
        ? (
            <Text>{t('timeout_exit_tip_off')}</Text>
          )
        : (
            <Text>{t('timeout_exit_tip_on', { time: formatTime(exitTimeInfo.time) })}</Text>
          )
      }
      {exitTimeInfo.isPlayedStop ? <Text color={theme['c-font-label']} size={13}>{t('timeout_exit_btn_wait_tip')}</Text> : null}
    </View>
  )
}


// 「播完停止」设置项（InputSheet extra slot）：勾选即落库，与确认动作解耦
const PlayedStopSetting = () => {
  const t = useI18n()
  const timeoutExitPlayed = useSettingValue('player.timeoutExitPlayed')
  const onCheckChange = (check: boolean) => {
    updateSetting({ 'player.timeoutExitPlayed': check })
  }

  return (
    <View>
      <CheckBox check={timeoutExitPlayed} label={t('timeout_exit_label_isPlayed')} onChange={onCheckChange} />
    </View>
  )
}

export const useTimeInfo = () => {
  const t = useI18n()
  // 懒初始化读真实计时态（审查 S-3，与 useTimeoutExitTimeInfo I-E 修复同构）：硬编码空值会让
  // 「激活态」首帧按钮文案/播完停止勾选闪变，paint 后才被订阅校正
  const [exitTimeInfo, setExitTimeInfo] = useState(() => {
    const isPlayedStop = global.lx.isPlayedStop
    if (getTimeoutExitTime() < 0) {
      return {
        cancelText: isPlayedStop ? t('timeout_exit_btn_wait_cancel') : '',
        confirmText: '',
        isPlayedStop,
        active: false,
      }
    }
    return {
      cancelText: t('timeout_exit_btn_cancel'),
      confirmText: t('timeout_exit_btn_update'),
      isPlayedStop,
      active: true,
    }
  })

  useEffect(() => {
    let active: boolean | null = null
    const remove = onTimeUpdate((time, isPlayedStop) => {
      if (time < 0) {
        if (active) {
          setExitTimeInfo({
            cancelText: isPlayedStop ? t('timeout_exit_btn_wait_cancel') : '',
            confirmText: '',
            isPlayedStop,
            active: false,
          })
          active = false
        }
      } else {
        if (active !== true) {
          setExitTimeInfo({
            cancelText: t('timeout_exit_btn_cancel'),
            confirmText: t('timeout_exit_btn_update'),
            isPlayedStop,
            active: true,
          })
          active = true
        }
      }
    })

    return () => {
      remove()
    }
  }, [t])

  return exitTimeInfo
}

export interface TimeoutExitEditModalType {
  show: () => void
}
interface TimeoutExitEditModalProps {
  timeInfo: ReturnType<typeof useTimeInfo>
}

// 定时关闭弹层（弹窗体系统一方案批2#6 迁 InputSheet）：InputSheet 扩展 4 props（description/
// extra/cancelText/onCancel）承接原 ConfirmAlert 内容+动态按钮+取消业务副作用。
// 原「分钟」单位标签有意移除（审查 PM-1 拍板）：placeholder「输入倒计时分钟数」已含单位语义，
// 超限 toast 兜底；timeout_exit_min 键随之废弃清理
export default forwardRef<TimeoutExitEditModalType, TimeoutExitEditModalProps>(({ timeInfo }, ref) => {
  const sheetRef = useRef<InputSheetType>(null)
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    show() {
      const preset = settingState.setting['player.timeoutExit'] ?? ''
      sheetRef.current?.showWithText(String(preset))
    },
  }))

  const handleCancel = () => {
    if (timeInfo.isPlayedStop) {
      cancelTimeoutExit()
      return
    }
    if (!timeInfo.active) return
    stopTimeoutExit()
    toast(t('timeout_exit_tip_cancel'))
  }
  const handleConfirm = (timeStr: string) => {
    if (rxp.test(timeStr)) {
      timeStr = RegExp.$1
      if (parseInt(timeStr) > MAX_MIN) {
        toast(t('timeout_exit_tip_max', { num: MAX_MIN }))
        return
      }
    } else {
      toast(t('input_error'))
      return
    }
    const time = parseInt(timeStr)
    cancelTimeoutExit()
    startTimeoutExit(time * 60)
    toast(t('timeout_exit_tip_on', { time: formatTime(getTimeoutExitTime()) }))
    updateSetting({ 'player.timeoutExit': String(time) })
    sheetRef.current?.hide()
  }

  return (
    <InputSheet
      ref={sheetRef}
      title={t('timeout_exit_title')}
      placeholder={t('timeout_exit_input_tip')}
      confirmText={timeInfo.confirmText}
      cancelText={timeInfo.cancelText}
      description={<Status />}
      extra={<PlayedStopSetting />}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  )
})
