// import { useEffect, useState } from 'react'
import { View } from 'react-native'
import ImageBackground from '@/components/common/ImageBackground'
import { useWindowSize } from '@/utils/hooks'
import { useMemo } from 'react'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import { useBgPic } from '@/store/common/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { BG_FALLBACK, BG_MASK_COLOR } from '@/screens/PlayDetail/constant'

interface Props {
  children: React.ReactNode
  /**
   * 播放页专用：强制封面模糊+深色遮罩背景，无视主题背景图与动态背景设置。
   * 播放页前景为恒定白字系（见 PlayDetail/constant.ts）。
   */
  forceCoverBg?: boolean
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)

// 模糊封面背景（动态背景与播放页沉浸背景共用结构，差异在图源、遮罩与兜底色的语义）
const BlurBackground = ({ pic, maskColor, maskOpacity = 1, backgroundColor, children }: {
  pic: string | null
  maskColor: string
  maskOpacity?: number
  backgroundColor: string
  children: React.ReactNode
}) => {
  const windowSize = useWindowSize()

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor }}
        source={pic ? { uri: pic, headers: defaultHeaders } : null}
        resizeMode="cover"
        blurRadius={BLUR_RADIUS}
      >
        <View style={{ flex: 1, flexDirection: 'column', backgroundColor: maskColor, opacity: maskOpacity }} />
      </ImageBackground>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {children}
      </View>
    </View>
  )
}

// 播放页沉浸背景：恒定当前播放封面模糊 + 深色遮罩，订阅隔离在本子树内
const ForceCoverBg = ({ children }: Props) => {
  const musicInfo = usePlayerMusicInfo()

  return (
    <>
      <SizeView />
      <BlurBackground pic={musicInfo?.pic ?? null} maskColor={BG_MASK_COLOR} backgroundColor={BG_FALLBACK}>
        {children}
      </BlurBackground>
    </>
  )
}

// 常规页面背景：特色主题背景图优先，其次动态背景（封面模糊+主题色遮罩），否则纯色
const NormalBg = ({ children }: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  const pic = useBgPic()

  const themeComponent = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
        source={theme['bg-image']}
        resizeMode="cover"
      />
      <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-main-background'] }}>
        {children}
      </View>
    </View>
  ), [children, theme, windowSize.height, windowSize.width])

  return (
    <>
      <SizeView />
      {
        pic
          ? (
              <BlurBackground
                pic={pic}
                maskColor={theme['c-content-background']}
                maskOpacity={0.76}
                backgroundColor={theme['c-content-background']}
              >
                {children}
              </BlurBackground>
            )
          : themeComponent
      }
    </>
  )
}

export default ({ children, forceCoverBg }: Props) => {
  if (forceCoverBg) return <ForceCoverBg>{children}</ForceCoverBg>
  return <NormalBg>{children}</NormalBg>
}
