import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useNavigationComponentDidAppear } from '@/navigation'
import { HEADER_HEIGHT } from './components/Header'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'
import { FONT_WHITE, FONT_WHITE_70 } from '../constant'


export default ({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
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
    const imgWidth = Math.min(winWidth * 0.85, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.42)
    return {
      width: imgWidth,
      height: imgWidth,
      borderRadius: 12,
    }
  }, [statusBarHeight, winHeight, winWidth])

  // 音源徽标：与下载/切源包装解包后取 source（仿收藏键的解包方式）；本地歌曲不显示
  const source = useMemo(() => {
    const info = playMusicInfo.musicInfo
    if (!info) return null
    const musicInfo = 'progress' in info ? info.metadata.musicInfo : info
    if (musicInfo.source == null || musicInfo.source == 'local') return null
    return musicInfo.source.toUpperCase()
  }, [playMusicInfo.musicInfo])

  return (
    <View style={styles.container}>
      <View style={{ ...styles.content, elevation: animated ? 3 : 0 }}>
        <Image url={pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={style} />
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name} size={22} color={FONT_WHITE}>{musicInfo.name}</Text>
        <View style={styles.singerRow}>
          <Text numberOfLines={1} style={styles.singer} size={13} color={FONT_WHITE_70}>{musicInfo.singer}</Text>
          {
            source ? (
              <View style={styles.badge}>
                <Text size={10} color={FONT_WHITE_70}>{source}</Text>
              </View>
            ) : null
          }
        </View>
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
    paddingLeft: 20,
    paddingRight: 20,
  },
  content: {
    backgroundColor: 'rgba(0,0,0,0)',
    borderRadius: 12,
  },
  info: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 24,
  },
  name: {
    fontWeight: '700',
    textAlign: 'center',
  },
  singerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    maxWidth: '100%',
  },
  singer: {
    flexShrink: 1,
  },
  badge: {
    flexGrow: 0,
    flexShrink: 0,
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
})
