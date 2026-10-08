// import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import ImageBackground from '@/components/common/ImageBackground'
import { useWindowSize } from '@/utils/hooks'
import { useMemo } from 'react'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import { useBgPic } from '@/store/common/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { BG_FALLBACK, BG_MASK_OPACITY } from '@/screens/PlayDetail/constant'

interface Props {
  children: React.ReactNode
  /**
   * 播放页专用：强制封面模糊+深色遮罩背景，无视主题背景图与动态背景设置。
   * 播放页前景为恒定白字系（见 PlayDetail/constant.ts）。
   */
  forceCoverBg?: boolean
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)

// forceCoverBg 独立成组件，把播放封面订阅隔离在子树内，避免影响其它页面的 PageContent
const ForceCoverBg = ({ children }: Props) => {
  const windowSize = useWindowSize()
  const musicInfo = usePlayerMusicInfo()
  const pic = musicInfo?.pic ?? null

  const content = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: BG_FALLBACK }}
        source={pic ? { uri: pic, headers: defaultHeaders } : null}
        resizeMode="cover"
        blurRadius={BLUR_RADIUS}
      >
        <View style={{ flex: 1, flexDirection: 'column', backgroundColor: `rgba(0,0,0,${BG_MASK_OPACITY})` }}></View>
      </ImageBackground>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {children}
      </View>
    </View>
  ), [children, pic, windowSize.height, windowSize.width])

  return content
}

export default ({ children, forceCoverBg }: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  const pic = useBgPic()
  // const [wh, setWH] = useState<{ width: number | string, height: number | string }>({ width: '100%', height: Dimensions.get('screen').height })

  // 固定宽高度 防止弹窗键盘时大小改变导致背景被缩放
  // useEffect(() => {
  //   const onChange = () => {
  //     setWH({ width: '100%', height: '100%' })
  //   }

  //   const changeEvent = Dimensions.addEventListener('change', onChange)
  //   return () => {
  //     changeEvent.remove()
  //   }
  // }, [])
  // const handleLayout = (e: LayoutChangeEvent) => {
  //   // console.log('handleLayout', e.nativeEvent)
  //   // console.log(Dimensions.get('screen'))
  //   setWH({ width: e.nativeEvent.layout.width, height: Dimensions.get('screen').height })
  // }
  // console.log('render page content')

  const themeComponent = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
        source={theme['bg-image']}
        resizeMode="cover"
      >
      </ImageBackground>
      <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-main-background'] }}>
        {children}
      </View>
    </View>
  ), [children, theme, windowSize.height, windowSize.width])
  const picComponent = useMemo(() => {
    return (
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ImageBackground
          style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
          source={{ uri: pic!, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
        >
          <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-content-background'], opacity: 0.76 }}></View>
        </ImageBackground>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {children}
        </View>
      </View>
    )
  }, [children, pic, theme, windowSize.height, windowSize.width])

  if (forceCoverBg) {
    return (
      <>
        <SizeView />
        <ForceCoverBg>{children}</ForceCoverBg>
      </>
    )
  }

  return (
    <>
      <SizeView />
      {pic ? picComponent : themeComponent}
    </>
  )
}
