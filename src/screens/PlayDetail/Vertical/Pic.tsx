import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import TextTicker from 'react-native-text-ticker'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useNavigationComponentDidAppear } from '@/navigation'
import { HEADER_HEIGHT } from './components/Header'
import Image from '@/components/common/Image'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'
import { scaleSizeW, setSpText } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { FontFamilies } from '@/components/common/Text'


export default ({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayerMusicInfo()
  const theme = useTheme()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()

  const [animated, setAnimated] = useState(!!commonState.componentIds.playDetail)
  const [pic, setPic] = useState(musicInfo.pic)
  useEffect(() => {
    if (animated) setPic(musicInfo.pic)
  }, [musicInfo.pic, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })
  // console.log('render pic')

  const style = useMemo(() => {
    const imgWidth = Math.min(winWidth * 0.8, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.44)
    return {
      width: imgWidth,
      height: imgWidth,
      borderRadius: scaleSizeW(12),
    }
  }, [statusBarHeight, winHeight, winWidth])

  const titlesWidth = useMemo(() => winWidth * 0.86, [winWidth])

  return (
    <View style={styles.container}>
      <View style={{ ...styles.content, elevation: animated ? 3 : 0 }}>
        <Image url={pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={style} />
      </View>
      <View style={{ ...styles.titles, width: titlesWidth }}>
        <TextTicker
          key={`name_${musicInfo.id}`}
          style={{ ...styles.title, color: theme['c-font'], fontFamily: FontFamilies.semibold, fontSize: setSpText(20) }}
          duration={6000}
          loop
          bounce={false}
          repeatSpacer={60}
          marqueeDelay={1200}
        >{musicInfo.name}</TextTicker>
        {
          musicInfo.singer
            ? (
                <TextTicker
                  key={`singer_${musicInfo.id}`}
                  style={{ ...styles.singer, color: theme['c-font-label'], fontSize: setSpText(14) }}
                  duration={6000}
                  loop
                  bounce={false}
                  repeatSpacer={60}
                  marqueeDelay={1200}
                >{musicInfo.singer}</TextTicker>
              )
            : null
        }
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    // elevation: 3,
    backgroundColor: 'rgba(0,0,0,0)',
    borderRadius: scaleSizeW(12),
  },
  titles: {
    paddingTop: 14,
  },
  title: {
    // fontFamily/fontSize/color 由调用处以 SF Pro 字重与主题色注入
  },
  singer: {
    paddingTop: 4,
  },
})
