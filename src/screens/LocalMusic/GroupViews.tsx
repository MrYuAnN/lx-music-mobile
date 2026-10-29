import { memo, useMemo } from 'react'
import { Animated, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { AnimatedFlatList, AnimatedSectionList } from '@/components/common/AnimatedLists'
import { usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { ICON_SIZE } from '@/config/constant'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'

// 三视图共用：顶栏/子头玻璃渐显驱动（可选接线，未传零 diff——OnlineList.scrollYAnimated 契约同构）
const useAnimatedScroll = (scrollYAnimated?: Animated.Value) => {
  return useMemo(() => {
    if (!scrollYAnimated) return undefined
    return Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollYAnimated } } }],
      { useNativeDriver: true },
    )
  }, [scrollYAnimated])
}

// 列表 paddingTop 契约（OnlineList.List.tsx 同构）：宿主传 contentPaddingTop（=顶栏+子头），
// 列表延伸整屏、内容经 contentContainerStyle 内化——真穿行（子头批三席审查 I-1：
// 原外层 View paddingTop 包裹使容器起点在子头之下，内容在子头底缘硬切非穿行）

export interface MusicGroup {
  name: string
  singer?: string
  list: LX.Music.MusicInfoLocal[]
}

// 行内公共渲染参数（红心/菜单/播放行为由父层注入，视图只管布局）
export interface GroupViewActions {
  isLiked: (id: string) => boolean
  onLikePress: (item: LX.Music.MusicInfo, isLiked: boolean) => void
  onSongPress: (item: LX.Music.MusicInfoLocal, list: LX.Music.MusicInfoLocal[]) => void
  onShowMenu: (item: LX.Music.MusicInfo, list: LX.Music.MusicInfoLocal[]) => void
}

const songRowInfo = { rowNum: undefined, rowWidth: '100%' } as const

const SongRow = memo(({ item, index, list, actions }: {
  item: LX.Music.MusicInfoLocal
  index: number
  list: LX.Music.MusicInfoLocal[]
  actions: GroupViewActions
}) => (
  <ListItem
qualityOverride={item.meta._qualitys}
    item={item}
    index={index}
    rowInfo={songRowInfo}
    selectedList={[]}
    showIndex={false}
    showCover
    showSource={false}
    // 时长行尾独立显示（2026-10-29 走查拍板）：与全应用列表行结构统一
    showInterval
    isLiked={actions.isLiked(item.id)}
    onLikePress={actions.onLikePress}
    onPress={(_, pressIndex) => { actions.onSongPress(list[pressIndex], list) }}
    onLongPress={pressedItem => { actions.onShowMenu(pressedItem, list) }}
    onShowMenu={itemInfo => { actions.onShowMenu(itemInfo, list) }}
  />
))

// 文件夹视图：按父目录分组 section（组头=目录名）
export const FolderSectionList = ({ folders, actions, scrollYAnimated, contentPaddingTop }: {
  folders: Array<{ key: string, name: string, data: LX.Music.MusicInfoLocal[] }>
  actions: GroupViewActions
  /** 顶栏/子头玻璃渐显驱动（毛玻璃全体系子头批）：可选，未传不挂 onScroll */
  scrollYAnimated?: Animated.Value
  /** 穿行 paddingTop（=顶栏+子头，子头批审查 I-1）：内化进 contentContainerStyle */
  contentPaddingTop?: number
}) => {
  const theme = useTheme()
  const t = useI18n()
  const handleAnimatedScroll = useAnimatedScroll(scrollYAnimated)
  // 底部穿行契约（2026-10-20）：列表延伸到屏底，让位保证末行可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  return (
    <AnimatedSectionList
      style={styles.list}
      contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: bottomInset }}
      sections={folders}
      keyExtractor={item => item.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={styles.folderHeader}>
          <Text size={13} color={theme['c-font']} numberOfLines={1}>{section.name}</Text>
          <Text size={12} color={theme['c-font-label']}>{t('local_music_songs_count', { n: section.data.length })}</Text>
        </View>
      )}
      renderItem={({ item, index, section }) => (
        <SongRow item={item} index={index} list={section.data} actions={actions} />
      )}
      onScroll={handleAnimatedScroll}
      scrollEventThrottle={handleAnimatedScroll ? 16 : undefined}
      showsVerticalScrollIndicator={false}
    />
  )
}

// 专辑视图：封面网格（numColumns=2，本地无封面→占位图标，本批预期形态）
export const AlbumGrid = ({ albums, onGroupPress, scrollYAnimated, contentPaddingTop }: {
  albums: MusicGroup[]
  onGroupPress: (group: MusicGroup) => void
  /** 顶栏/子头玻璃渐显驱动（毛玻璃全体系子头批）：可选，未传不挂 onScroll */
  scrollYAnimated?: Animated.Value
  /** 穿行 paddingTop（=顶栏+子头，子头批审查 I-1）：内化进 contentContainerStyle */
  contentPaddingTop?: number
}) => {
  const theme = useTheme()
  const handleAnimatedScroll = useAnimatedScroll(scrollYAnimated)
  // 底部穿行契约（2026-10-20）：列表延伸到屏底，让位保证末行可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  return (
    <AnimatedFlatList
      style={styles.list}
      contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: bottomInset }}
      data={albums}
      numColumns={2}
      keyExtractor={item => `album__${item.name}`}
      columnWrapperStyle={styles.gridRow}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.gridItem} activeOpacity={0.7} onPress={() => { onGroupPress(item) }}>
          <View style={{ ...styles.gridPic, backgroundColor: theme['c-border-background'] }}>
            <Icon name="music" size={30} color={theme['c-font-label']} />
          </View>
          <Text style={styles.gridName} size={13} numberOfLines={1}>{item.name}</Text>
          <Text size={12} color={theme['c-font-label']} numberOfLines={1}>{item.singer}</Text>
        </TouchableOpacity>
      )}
      onScroll={handleAnimatedScroll}
      scrollEventThrottle={handleAnimatedScroll ? 16 : undefined}
      showsVerticalScrollIndicator={false}
    />
  )
}

// 歌手视图：圆形字头聚合列表（原型 5），点入二级歌曲列表
export const ArtistList = ({ artists, onGroupPress, scrollYAnimated, contentPaddingTop }: {
  artists: MusicGroup[]
  onGroupPress: (group: MusicGroup) => void
  /** 顶栏/子头玻璃渐显驱动（毛玻璃全体系子头批）：可选，未传不挂 onScroll */
  scrollYAnimated?: Animated.Value
  /** 穿行 paddingTop（=顶栏+子头，子头批审查 I-1）：内化进 contentContainerStyle */
  contentPaddingTop?: number
}) => {
  const theme = useTheme()
  const t = useI18n()
  const handleAnimatedScroll = useAnimatedScroll(scrollYAnimated)
  // 底部穿行契约（2026-10-20）：列表延伸到屏底，让位保证末行可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  return (
    <AnimatedFlatList
      style={styles.list}
      contentContainerStyle={{ paddingTop: contentPaddingTop, paddingBottom: bottomInset }}
      data={artists}
      keyExtractor={item => `artist__${item.name}`}
      // getItemLayout offset 不含 contentContainer padding（RN 已知口径，Mylist MusicList/List.tsx
      // 同款先例注记）：本视图无 scrollToIndex 调用故无漂移路径；未来接「定位当前播放」类功能
      // 须把 paddingTop 计入 offset
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.artistRow} activeOpacity={0.7} onPress={() => { onGroupPress(item) }}>
          <View style={{ ...styles.artistAvatar, backgroundColor: theme['c-border-background'] }}>
            <Text size={16} color={theme['c-font-label']}>{item.name.slice(0, 1)}</Text>
          </View>
          <View style={styles.artistInfo}>
            <Text size={15} numberOfLines={1}>{item.name}</Text>
            <Text size={12} color={theme['c-font-label']}>{t('local_music_songs_count', { n: item.list.length })}</Text>
          </View>
          <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-300']} />
        </TouchableOpacity>
      )}
      onScroll={handleAnimatedScroll}
      scrollEventThrottle={handleAnimatedScroll ? 16 : undefined}
      showsVerticalScrollIndicator={false}
    />
  )
}

// 歌手聚合口径（优化师 S2）：多歌手字段按常见分隔符拆分去重，一曲可入多桶
export const splitSingers = (singer: string): string[] => {
  return singer.split(/[/\\、,，;；&]/).map(s => s.trim()).filter(Boolean)
}

const styles = createStyle({
  list: {
    flex: 1,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: scaleSizeH(40),
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
  },
  gridRow: {
    paddingHorizontal: SPACING.s16,
    gap: SPACING.s10,
    marginBottom: SPACING.s14,
  },
  gridItem: {
    flex: 1,
  },
  gridPic: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: scaleSizeW(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.s6,
  },
  gridName: {
    marginBottom: 1,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
  },
  artistAvatar: {
    width: scaleSizeW(40),
    height: scaleSizeW(40),
    borderRadius: scaleSizeW(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.s12,
  },
  artistInfo: {
    flex: 1,
    flexShrink: 1,
    gap: SPACING.s2,
    marginRight: SPACING.s6,
  },
})
