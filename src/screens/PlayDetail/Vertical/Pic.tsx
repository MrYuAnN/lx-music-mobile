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

// 封面页高度公式单源（2026-10-23 批 F4 控制集群顶部锚定）：art 表达式=getPicArtHeight（Pic 的
// imgWidth 与 Vertical 的 pager 定高共同调用，改系数只动这里）；页区高=getPicZoneHeight=art+74。
// 74 构成：标题区 pt14+题行高 27+隙 4+歌手行高 19+容器底距 10——题/歌手行高已由 style lineHeight
// 锚定+allowFontScaling=false（三席审查 I-2：定高页缘容不得字体缩放膨胀），数值确定性成立
export const getPicArtHeight = (winWidth: number, winHeight: number, statusBarHeight: number): number =>
  Math.min(winWidth * 0.92, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.52)
export const getPicZoneHeight = (winWidth: number, winHeight: number, statusBarHeight: number): number =>
  getPicArtHeight(winWidth, winHeight, statusBarHeight) + 74

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
    // 「封面够大+顶部近贴头部」；0.92 屏宽=侧边距 16dp 页面边距档）。单源=getPicArtHeight
    const imgWidth = getPicArtHeight(winWidth, winHeight, statusBarHeight)
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
          allowFontScaling={false}
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
                  allowFontScaling={false}
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
    // 顶部锚定（2026-10-23 批 F4 集群上移定案：封面/歌名/控制集群整体近贴头部，余量沉到胶囊
    // 下方页底；底部锚定形态已走查否决——顶部空带即其产物）；底距 10=歌名→功能行行距（统一行距）
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: SPACING.s10,
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
    // lineHeight 锚定（getPicZoneHeight 公式构成项，定高页缘不容行高浮动）
    lineHeight: 27,
  },
  singer: {
    paddingTop: SPACING.s4,
    lineHeight: 19,
  },
})
