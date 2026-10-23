import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import TextTicker from 'react-native-text-ticker'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { useNavigationComponentDidAppear } from '@/navigation'
import { HEADER_HEIGHT } from './components/Header'
import Image from '@/components/common/Image'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'
import { scaleSizeW, setSpText } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { FontFamilies } from '@/components/common/Text'
import { SPACING } from '@/config/spacing'

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
    // 封面尺寸（2026-10-23 走查反馈：头部与封面间大空隙——业界无此形态，AM/Spotify/YTM 均为
    // 「封面够大+顶部近贴头部，余量留给封面与控制区之间」；0.8→0.92 屏宽（侧边距收至页面边距
    // 16dp 档）、高度系数 0.44→0.52，余量从 ~108dp 收敛到 ~60dp 呼吸位；后续若立项全出血沉浸
    // （AM iOS 26/YTM 新形态）再单独立项）
    const imgWidth = Math.min(winWidth * 0.92, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.52)
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
        <Image url={pic} style={style} />
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
    // 底部锚定（2026-10-23 走查反馈：原 center 居中把余量均分到标题下方，歌名离功能行过远；
    // 改贴底后歌名紧贴 ActionRow，弹性余量留在封面上方——AM/Spotify 同为「标题贴控制区」锚定）
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: SPACING.s6,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    // elevation: 3,
    backgroundColor: 'rgba(0,0,0,0)',
    borderRadius: scaleSizeW(12),
  },
  titles: {
    paddingTop: SPACING.s14,
  },
  title: {
    // fontFamily/fontSize/color 由调用处以 SF Pro 字重与主题色注入
  },
  singer: {
    paddingTop: SPACING.s4,
  },
})
