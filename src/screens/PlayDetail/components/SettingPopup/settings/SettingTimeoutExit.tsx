import { memo, useRef } from 'react'
import { TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo, formatTime } from '@/components/TimeoutExitEditModal'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { createStyle } from '@/utils/tools'
import Card from './Card'
import { scaleSizeH } from '@/utils/pixelRatio'

// 「定时关闭」入口行（2026-10-20 播放页打磨批：原顶栏定时钮迁入更多弹层）。
// 右侧状态值：关闭 / 播完停止（计时结束等待播完）/ 剩余倒计时（激活红字，每秒刷新）
const Status = ({ theme, t }: { theme: ReturnType<typeof useTheme>, t: ReturnType<typeof useI18n> }) => {
  const exitTimeInfo = useTimeoutExitTimeInfo()

  return (
    exitTimeInfo.time < 0
      ? (
          <Text
            size={13}
            color={theme['c-font-label']}
            style={styles.status}
          >{exitTimeInfo.isPlayedStop ? t('timeout_exit_state_played_stop') : t('close')}</Text>
        )
      : (
          <Text
            size={13}
            color={theme['c-primary']}
            style={styles.status}
          >{formatTime(exitTimeInfo.time)}</Text>
        )
  )
}

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const modalRef = useRef<TimeoutExitEditModalType>(null)
  const timeInfo = useTimeInfo()

  return (
    <>
      <Card>
        <TouchableOpacity style={styles.container} activeOpacity={0.6} onPress={() => { modalRef.current?.show() }}>
          <Text size={15}>{t('timeout_exit_title')}</Text>
          <Status theme={theme} t={t} />
        </TouchableOpacity>
      </Card>
      <TimeoutExitEditModal ref={modalRef} timeInfo={timeInfo} />
    </>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    height: scaleSizeH(40),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    fontVariant: ['tabular-nums'],
  },
})
