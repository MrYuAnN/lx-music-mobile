import { useCallback, useMemo, useRef, useState } from 'react'
import { TouchableOpacity } from 'react-native'

import GlassSurface from '@/components/common/GlassSurface'
import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
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
// 三键配色 AM 同构主字色（2026-10-20 拍板）：浅底近黑/深底白，品牌红只留进度条与播放模式激活态；
// 尺寸分层：播放键 0.82x / 前后键 0.56x（对标 AM 主次关系，原一律 0.7x 无层级）。
// 播放模式钮恒品牌红（2026-10-21 用户拍板：按钮即当前模式，选中态五模式统一红，弃「线性态灰」旧映射）。

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
      <Icon name='prevMusic' color={theme['c-font']} size={size * 0.56} />
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
      <Icon name='nextMusic' color={theme['c-font']} size={size * 0.56} />
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
      <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-font']} size={size * 0.82} />
    </TouchableOpacity>
  )
}

// 播放模式：CheckSheet 玻璃单选（弹窗体系标准容器，音质切换同款；原 MenuView 原生弹窗退役 2026-10-20）
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
  const [sheetVisible, setSheetVisible] = useState(false)
  const sheetRef = useRef<CheckSheetType>(null)

  const options = useMemo<readonly CheckSheetItem[]>(() => {
    return MUSIC_TOGGLE_MODE_LIST.map(mode => ({
      action: mode,
      label: t(modeName(mode)),
    }))
  }, [t])

  const showSheet = useCallback(() => {
    setSheetVisible(true)
    requestAnimationFrame(() => {
      sheetRef.current?.show()
    })
  }, [])

  const handleModeChange = useCallback((item: CheckSheetItem) => {
    const mode = MUSIC_TOGGLE_MODE_LIST.find(m => m == item.action)
    if (!mode) return
    updateSetting({ 'player.togglePlayMethod': mode })
  }, [])

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
    <>
      <TouchableOpacity
        style={{ ...styles.cotrolBtn, width: SIDE_BTN_WIDTH, height: SIDE_BTN_WIDTH }}
        activeOpacity={0.5}
        onPress={showSheet}
      >
        <Icon
          name={playModeIcon}
          color={theme['c-primary']}
          size={SIDE_BTN_ICON}
        />
      </TouchableOpacity>
      {
        sheetVisible
          ? (
              <CheckSheet
                ref={sheetRef}
                title={t('play_mode')}
                options={options}
                value={togglePlayMethod}
                onPress={handleModeChange}
                onHide={() => { setSheetVisible(false) }}
              />
            )
          : null
      }
    </>
  )
}

const MAX_SIZE = SIDE_BTN_WIDTH * 1.6
const MIN_SIZE = SIDE_BTN_WIDTH * 1.2

export default () => {
  const theme = useTheme()
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
    // 「四黑一红」（2026-10-21 拍板）：前后/播放/列表四动作键统一主字色，红仅播放模式状态
    <GlassSurface
      style={{ ...containerStyle, borderRadius: 24, overflow: 'hidden' }}
      fallbackColor="rgba(0, 0, 0, 0)"
      hairline="all"
    >
      <PlayModeBtn />
      <PrevBtn size={size} />
      <TogglePlayBtn size={size}/>
      <NextBtn size={size} />
      <QueueBtn color={theme['c-font']} />
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
