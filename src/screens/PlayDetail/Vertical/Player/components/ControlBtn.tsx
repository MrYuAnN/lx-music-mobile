import { useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import GlassSurface from '@/components/common/GlassSurface'
import { MenuView } from '@react-native-menu/menu'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST, ICON_SIZE } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { scaleSizeW } from '@/utils/pixelRatio'
import { hapticImpactLight } from '@/utils/haptic'
import QueueBtn from '@/screens/PlayDetail/components/QueueBtn'

// AM 控制行五键（方案 §问题7，参考图1）：[播放模式][上一首][播放][下一首][播放列表]——
// 两端小尺寸键（原 MoreBtn 行的播放模式/播放列表迁入），中间三大键。

const SIDE_BTN_WIDTH = scaleSizeW(36)
const SIDE_BTN_ICON = ICON_SIZE.control

const PrevBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayPrev = () => {
    hapticImpactLight()
    void playPrev()
  }
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, width: size, height: size }} activeOpacity={0.5} onPress={handlePlayPrev}>
      <Icon name='prevMusic' color={theme['c-button-font']} size={size * 0.7} />
    </TouchableOpacity>
  )
}
const NextBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayNext = () => {
    hapticImpactLight()
    void playNext()
  }
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, width: size, height: size }} activeOpacity={0.5} onPress={handlePlayNext}>
      <Icon name='nextMusic' color={theme['c-button-font']} size={size * 0.7} />
    </TouchableOpacity>
  )
}

const TogglePlayBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const isPlay = useIsPlay()
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, width: size, height: size }} activeOpacity={0.5} onPress={() => {
      hapticImpactLight()
      togglePlay()
    }}>
      <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-button-font']} size={size * 0.7} />
    </TouchableOpacity>
  )
}

// AM 播放模式：MenuView 四态弹出选择（原 MoreBtn/PlayModeBtn 迁入，逻辑不变）
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

const PlayModeBtn = () => {
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
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        return 'list-loop'
      case MUSIC_TOGGLE_MODE.random:
        return 'list-random'
      case MUSIC_TOGGLE_MODE.list:
        return 'list-order'
      case MUSIC_TOGGLE_MODE.singleLoop:
        return 'single-loop'
      default:
        return 'single'
    }
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
        style={{ ...styles.cotrolBtn, width: SIDE_BTN_WIDTH, height: SIDE_BTN_WIDTH, opacity: pressed ? 0.5 : 1 }}
        onTouchStart={() => { setPressed(true) }}
        onTouchEnd={() => { setPressed(false) }}
        onTouchCancel={() => { setPressed(false) }}
      >
        <Icon name={playModeIcon} color={theme['c-font-label']} size={SIDE_BTN_ICON} />
      </View>
    </MenuView>
  )
}

const MAX_SIZE = SIDE_BTN_WIDTH * 1.6
const MIN_SIZE = SIDE_BTN_WIDTH * 1.2

export default () => {
  const winSize = useWindowSize()
  const maxHeight = Math.max(winSize.height * 0.11, MIN_SIZE)
  const containerStyle = useMemo(() => {
    return {
      ...styles.conatiner,
      maxHeight,
    }
  }, [maxHeight])
  // 图标不随用户字号缩放（AM-6 拍板：图标脱离字号体系），尺寸仅由窗口宽推导
  const size = Math.min(Math.max(winSize.width * 0.33 * 0.4, MIN_SIZE), MAX_SIZE, maxHeight)

  return (
    // 玻璃胶囊（毛玻璃全体系阶段四，方案 §6）：主控制钮组整组胶囊，背景恒封面模糊/渐变不受影响；
    // 回退=透明底（API<31 无玻璃即现状观感，fallbackColor 透明）
    <GlassSurface
      style={{ ...containerStyle, borderRadius: 24, overflow: 'hidden' }}
      fallbackColor="rgba(0, 0, 0, 0)"
      hairline="all"
    >
      <PlayModeBtn />
      <PrevBtn size={size} />
      <TogglePlayBtn size={size}/>
      <NextBtn size={size} />
      <QueueBtn />
    </GlassSurface>
  )
}


const styles = createStyle({
  conatiner: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: '4%',
    paddingVertical: 22,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
  cotrolBtn: {
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    textShadowRadius: 1,
  },
})
