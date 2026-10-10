import { memo, useMemo, useState } from 'react'
import { View } from 'react-native'
import { MenuView } from '@react-native-menu/menu'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { BTN_WIDTH, BTN_ICON_SIZE } from './Btn'

// AM 播放模式：MenuView 四态弹出选择（对标 AM 播放模式弹层），替代循环点击 + toast
type ModeName = 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'
const modeName = (mode: string): ModeName => {
  switch (mode) {
    case MUSIC_TOGGLE_MODE.listLoop:
      return 'play_list_loop'
    case MUSIC_TOGGLE_MODE.random:
      return 'play_list_random'
    case MUSIC_TOGGLE_MODE.list:
      return 'play_list_order'
    case MUSIC_TOGGLE_MODE.singleLoop:
      return 'play_single_loop'
    default:
      return 'play_single'
  }
}

export default memo(() => {
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const t = useI18n()
  const theme = useTheme()
  const [pressed, setPressed] = useState(false)

  const actions = useMemo(() => {
    return MUSIC_TOGGLE_MODE_LIST.map(mode => ({
      id: mode,
      title: t(modeName(mode)),
      state: mode == togglePlayMethod ? ('on' as const) : undefined,
    }))
  }, [t, togglePlayMethod])

  const playModeIcon = useMemo(() => {
    let playModeIcon = 'list-loop'
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        playModeIcon = 'list-loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        playModeIcon = 'list-random'
        break
      case MUSIC_TOGGLE_MODE.list:
        playModeIcon = 'list-order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        playModeIcon = 'single-loop'
        break
      default:
        playModeIcon = 'single'
        break
    }
    return playModeIcon
  }, [togglePlayMethod])

  return (
    <MenuView
      onPressAction={({ nativeEvent: { event } }) => {
        const mode = MUSIC_TOGGLE_MODE_LIST.find(m => m == event)
        if (!mode) return
        updateSetting({ 'player.togglePlayMethod': mode })
      }}
      actions={actions}
    >
      {/* 按压反馈用 onTouch 驱动 opacity（不用 Touchable，避免拦截 MenuView 的原生点击） */}
      <View
        style={{ ...styles.cotrolBtn, width: BTN_WIDTH, height: BTN_WIDTH, opacity: pressed ? 0.5 : 1 }}
        onTouchStart={() => { setPressed(true) }}
        onTouchEnd={() => { setPressed(false) }}
        onTouchCancel={() => { setPressed(false) }}
      >
        <Icon name={playModeIcon} color={theme['c-font-label']} size={BTN_ICON_SIZE} />
      </View>
    </MenuView>
  )
})

const styles = createStyle({
  cotrolBtn: {
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
