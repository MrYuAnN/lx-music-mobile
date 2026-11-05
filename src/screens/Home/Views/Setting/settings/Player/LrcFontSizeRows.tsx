import { memo, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import Slider from '../../components/Slider'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { FORM_ROW_PADDING } from '@/config/form'
import { SPACING } from '@/config/spacing'
import { createStyle } from '@/utils/tools'

// 「歌词字号」两行（2026-11-05 弹窗重构批：自播放页更多弹层（横屏）迁入设置页歌词组，
// 竖屏横屏两键独立成行——两布局字号独立设计（默认 210/220）不合并；原弹窗组件
// SettingLrcFontSize 本体保留（竖屏歌词动作行 SheetBase 仍在消费）。滑杆行形态为
// fork 首个设置页滑杆行（无先例）：滑杆行为沿弹窗版组件同参（100-300/step2/松手落盘），
// 行容器沿 FORM_ROW_PADDING 表单惯例（审查 I-PM2 措辞修正））
const DIRECTIONS = [
  { direction: 'vertical', labelKey: 'setting_play_lrc_font_size_vertical', settingKey: 'playDetail.vertical.style.lrcFontSize' },
  { direction: 'horizontal', labelKey: 'setting_play_lrc_font_size_horizontal', settingKey: 'playDetail.horizontal.style.lrcFontSize' },
] as const

const FontSizeRow = ({ label, settingKey }: { label: string, settingKey: 'playDetail.vertical.style.lrcFontSize' | 'playDetail.horizontal.style.lrcFontSize' }) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue(settingKey)
  const [sliderSize, setSliderSize] = useState(lrcFontSize)
  const [isSliding, setSliding] = useState(false)

  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <Text style={styles.label}>{label}</Text>
        <Text size={13} color={theme['c-font-label']} style={styles.value}>{isSliding ? sliderSize : lrcFontSize}</Text>
      </View>
      <Slider
        minimumValue={100}
        maximumValue={300}
        step={2}
        value={lrcFontSize}
        onSlidingStart={() => { setSliding(true) }}
        onValueChange={setSliderSize}
        onSlidingComplete={value => {
          setSliding(false)
          if (lrcFontSize == value) return
          updateSetting({ [settingKey]: value })
        }}
      />
    </View>
  )
}

export default memo(() => {
  const t = useI18n()

  return (
    DIRECTIONS.map(({ direction, labelKey, settingKey }) => (
      <FontSizeRow key={direction} label={t(labelKey)} settingKey={settingKey} />
    ))
  )
})

const styles = createStyle({
  row: {
    ...FORM_ROW_PADDING,
    minHeight: 44,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: SPACING.s8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flexGrow: 1,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
})
