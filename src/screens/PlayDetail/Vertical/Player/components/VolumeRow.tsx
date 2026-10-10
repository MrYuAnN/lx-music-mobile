import { memo, useState } from 'react'

import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { Icon } from '@/components/common/Icon'
import Slider, { type SliderProps } from '@/components/common/Slider'
import { updateSetting } from '@/core/common'
import { setVolume } from '@/plugins/player'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'

// AM 播放页音量行：图标随音量分级 + 滑块（数值仅在拖动时由滑块自身反馈，无数字标签）
const VolumeIcon = ({ volume }: { volume: number }) => {
  const theme = useTheme()
  const name = volume == 0
    ? 'volume-off'
    : volume < 0.3
      ? 'volume-low'
      : volume < 0.7
        ? 'volume-medium'
        : 'volume-higt'
  return <Icon name={name} size={ICON_SIZE.inline} color={theme['c-font-label']} style={styles.icon} />
}

export default memo(() => {
  const volume = useSettingValue('player.volume')
  const [sliderValue, setSliderValue] = useState(volume * 100)
  const [isSliding, setSliding] = useState(false)

  // 图标档位拖动中随本地值、其余场景随 store 值（SettingPopup 双入口改音量时同步）
  const iconVolume = isSliding ? sliderValue / 100 : volume

  const handleValueChange: SliderProps['onValueChange'] = value => {
    value = Math.trunc(value)
    setSliderValue(value)
    void setVolume(value / 100)
  }
  const handleSlidingComplete: SliderProps['onSlidingComplete'] = value => {
    setSliding(false)
    value = Math.trunc(value)
    if (Math.trunc(volume * 100) == value) return
    updateSetting({ 'player.volume': value / 100 })
  }

  return (
    <View style={styles.container}>
      <VolumeIcon volume={iconVolume} />
      <Slider
        minimumValue={0}
        maximumValue={100}
        onSlidingStart={() => { setSliding(true) }}
        onSlidingComplete={handleSlidingComplete}
        onValueChange={handleValueChange}
        step={1}
        value={Math.trunc(volume * 100)}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
    paddingBottom: 6,
  },
  icon: {
    flexShrink: 0,
  },
})
