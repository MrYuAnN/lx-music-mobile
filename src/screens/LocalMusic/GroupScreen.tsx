import { useCallback, useMemo, useRef } from 'react'
import { Animated, FlatList } from 'react-native'

import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder, usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import LocalMusicMenu, { type LocalMusicMenuType } from './LocalMusicMenu'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useLikedSet, useLikeToggle } from '@/store/list/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { LIST_IDS, storageDataPrefix, SCREEN_HEADER_HEIGHT } from '@/config/constant'
import { createStyle } from '@/utils/tools'

export interface LocalMusicGroupProps {
  componentId: string
  /** 聚合类型：album=专辑 / artist=歌手（页头语义标识） */
  type: 'album' | 'artist'
  /** 专辑名/歌手名（页头标题） */
  value: string
  /** 该聚合下的歌曲（push passProps 快照） */
  list: LX.Music.MusicInfoLocal[]
}

// 本地音乐聚合二级屏（问题 3 §4.4）：统一歌曲行，点击直接播放（与全应用行交互一致），
// 长按/三点弹本地歌曲菜单；播放链与主页一致（快照列表注入临时列表）
export default ({ componentId, value, list }: LocalMusicGroupProps) => {
  const likedSet = useLikedSet()
  const toggleLike = useLikeToggle()
  // 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）
  const statusBarHeight = useStatusbarHeight()
  // 底部穿行契约（2026-10-20）：列表延伸到屏底，让位保证末行可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])
  const menuRef = useRef<LocalMusicMenuType>(null)

  // native onScroll（useNativeDriver）要求滚动组件经 createAnimatedComponent 包装（QQ 式渐显 D2 同款），模块级构造防重挂
  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList

  const handlePlay = useCallback((item: LX.Music.MusicInfoLocal, playList_: LX.Music.MusicInfoLocal[]) => {
    // 本地歌与在线歌共用临时列表播放链（播放器按 source 分流取 URL）
    void setTempList(storageDataPrefix.TEMP_LIST_LOCAL, playList_).then(() => {
      const index = playList_.findIndex(m => m.id == item.id)
      if (index > -1) void playList(LIST_IDS.TEMP, index)
    })
  }, [])

  return (
    <PageContent>
      <AnimatedFlatList
        style={styles.list}
        contentContainerStyle={{ paddingTop: statusBarHeight + SCREEN_HEADER_HEIGHT, paddingBottom: bottomInset }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        data={list}
        keyExtractor={item => item.id}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => (
          <ListItem
            item={item}
            index={index}
            rowInfo={{ rowNum: undefined, rowWidth: '100%' }}
            selectedList={[]}
            showIndex={false}
            showCover
            showSource={false}
            showInterval={false}
            showSublineInterval
            isLiked={likedSet.has(item.id)}
            onLikePress={toggleLike}
            onPress={(_, pressIndex) => { handlePlay(list[pressIndex], list) }}
            onLongPress={pressedItem => { menuRef.current?.show(pressedItem as LX.Music.MusicInfoLocal, list) }}
            onShowMenu={itemInfo => { menuRef.current?.show(itemInfo as LX.Music.MusicInfoLocal, list) }}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      {/* 悬浮头后声明（RN 后声明者在上，C-1 层级修复）；无子头无大标题→标题常显（2026-10-23 判据修订拍板 #6） */}
      <ScreenHeader componentId={componentId} title={value} progress={scrollY} alwaysShowTitle />
      <LocalMusicMenu ref={menuRef} />
      <PlayerBarPlaceholder />
    </PageContent>
  )
}

const styles = createStyle({
  list: {
    flex: 1,
  },
})
