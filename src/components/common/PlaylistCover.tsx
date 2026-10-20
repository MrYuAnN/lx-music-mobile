import { View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'

// 歌单封面渐变占位（无 pic 歌单按 id 稳定取一组渐变+音符标）：首页 shelf 与添加歌曲页
// 「其他歌单」网格共用（2026-10-20 从 HomeSections 抽出单源）
const COVER_GRADIENTS: Array<[string, string]> = [
  ['#FA233B', '#FF7A59'],
  ['#4F46E5', '#9333EA'],
  ['#0EA5E9', '#22D3EE'],
  ['#F59E0B', '#F43F5E'],
  ['#10B981', '#34D399'],
  ['#6366F1', '#EC4899'],
]

const PlaylistCover = ({ id, size }: { id: string, size: number }) => {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const [from, to] = COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length]
  return (
    <View style={{ ...styles.plCover, width: size, height: size, backgroundColor: from }}>
      <View style={{ ...styles.plCoverTo, backgroundColor: to }} />
      <Icon name="music" size={size * 0.34} color="rgba(255,255,255,0.9)" style={styles.plCoverIcon} />
    </View>
  )
}

const styles = createStyle({
  plCover: {
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plCoverTo: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    opacity: 0.65,
  },
  plCoverIcon: {},
})

export default PlaylistCover
