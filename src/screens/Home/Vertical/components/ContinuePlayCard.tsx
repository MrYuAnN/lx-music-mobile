import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { useIsPlay, usePlayerMusicInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { togglePlay } from '@/core/player/player'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

const PIC_SIZE = scaleSizeW(48)

// 继续播放卡：显示当前播放歌曲；临时播放隐藏（播放列表已删/越界时 playMusicInfo 为空同样隐藏），
// 点击为普通跳转播放页（不挂共享元素，避免与 PlayerBar 封面同屏双源）
export default () => {
  const theme = useTheme()
  const playMusicInfo = usePlayMusicInfo()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()

  if (!musicInfo.id || playMusicInfo.isTempPlay) return null

  const openPlayDetail = () => {
    if (!commonState.componentIds.home) return
    navigations.pushPlayDetailScreen(commonState.componentIds.home, true)
  }

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
      <TouchableOpacity style={styles.main} onPress={openPlayDetail} activeOpacity={0.7}>
        <Image url={musicInfo.pic} style={{ ...styles.pic, backgroundColor: theme['c-primary-light-400-alpha-900'] }} />
        <View style={styles.info}>
          <Text numberOfLines={1} size={16} color={theme['c-font']}>{musicInfo.name}</Text>
          <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{musicInfo.singer}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toggleBtn} onPress={togglePlay} activeOpacity={0.7}>
        <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-button-font']} size={20} />
      </TouchableOpacity>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 4,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pic: {
    width: PIC_SIZE,
    height: PIC_SIZE,
    borderRadius: 10,
  },
  info: {
    flex: 1,
    flexShrink: 1,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 2,
  },
  toggleBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
