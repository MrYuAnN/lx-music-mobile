import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, View } from 'react-native'

import Text from '@/components/common/Text'
import ActionSheet, { type ActionSheetType, type ActionSheetItem } from '@/components/common/ActionSheet'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder, usePlayerBarBottomInset } from '@/components/player/PlayerBar'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { getRecentPlayList, removeRecentPlay, type RecentPlayItem } from '@/core/player/recentPlay'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { useLikedSet, useLikeToggle } from '@/store/list/hook'
import { useDownloadedSet, action as downloadedAction } from '@/store/downloaded'
import { toOnlineIdentity } from '@/utils/music'
import { LIST_IDS, storageDataPrefix, SCREEN_HEADER_HEIGHT } from '@/config/constant'
import { createStyle } from '@/utils/tools'

const RECENT_TEMP_LIST_ID = storageDataPrefix.TEMP_LIST_RECENT

// native onScroll（useNativeDriver）要求滚动组件经 createAnimatedComponent 包装（QQ 式渐显 D2 同款），模块级构造防重挂
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList

// 最近播放（问题 1 §2.6）：统一歌曲行（封面行首、无序号、行尾菜单）；
// 挂载快照不重排（浏览期间不实时重排，点击播放用快照索引），快照注入临时列表播放；
// 显式删除记录例外——就地移除该行（快照语义仅豁免播放自动新增）
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  // 底部穿行契约（2026-10-20）：列表延伸到屏底，让位保证末行可滚出迷你条
  const bottomInset = usePlayerBarBottomInset()
  const [list, setList] = useState<RecentPlayItem[]>(() => [...getRecentPlayList()])
  const downloadedSet = useDownloadedSet()
  // 广播同步（新批问题1）：空表时整表采纳（initRecentPlay 初值灌入）；其后保序替换命中行并移除已删行，
  // 新增不插入（浏览期不重排约定不变，仅豁免封面回写与删除的行内容同步）
  useEffect(() => {
    const handleUpdate = (newList: RecentPlayItem[]) => {
      setList(prev => {
        if (prev.length === 0) return newList.length ? [...newList] : prev
        const freshMap = new Map(newList.map(n => [`${n.musicInfo.source}__${n.musicInfo.id}`, n]))
        let changed = false
        const next: RecentPlayItem[] = []
        for (const item of prev) {
          const fresh = freshMap.get(`${item.musicInfo.source}__${item.musicInfo.id}`)
          if (!fresh) {
            changed = true
            continue
          }
          if (fresh != item) changed = true
          next.push(fresh)
        }
        return changed ? next : prev
      })
    }
    global.state_event.on('recentPlayUpdated', handleUpdate)
    return () => {
      global.state_event.off('recentPlayUpdated', handleUpdate)
    }
  }, [])
  const likedSet = useLikedSet()
  const toggleLike = useLikeToggle()
  // 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：header 悬浮玻璃，列表延伸整屏 paddingTop 补偿
  const statusBarHeight = useStatusbarHeight()
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])
  const menuRef = useRef<ActionSheetType>(null)
  const listMusicAddRef = useRef<MusicAddModalType>(null)
  const selectedRef = useRef<{ item: LX.Music.MusicInfo, index: number }>({ item: null as unknown as LX.Music.MusicInfo, index: -1 })

  const handlePlay = useCallback(async(index: number) => {
    // 与搜索歌单试听同模式：最近播放列表注入临时列表播放
    const musicInfos = list.map(item => item.musicInfo)
    await setTempList(RECENT_TEMP_LIST_ID, musicInfos)
    void playList(LIST_IDS.TEMP, index)
  }, [list])

  const showMenu = useCallback((item: LX.Music.MusicInfo, index: number) => {
    selectedRef.current = { item, index }
    menuRef.current?.show()
  }, [])

  const menus: ActionSheetItem[] = [
    { action: 'play', label: t('play'), icon: 'play' },
    { action: 'playLater', label: t('play_later'), icon: 'play-later' },
    { action: 'add', label: t('add_to'), icon: 'add-to' },
    { action: 'removeRecord', label: t('recent_play_remove_record'), icon: 'remove', destructive: true },
  ]

  const handleMenuPress = useCallback(({ action }: ActionSheetItem) => {
    const { item, index } = selectedRef.current
    switch (action) {
      case 'play':
        void handlePlay(index)
        break
      case 'playLater':
        addTempPlayList([{ listId: '', musicInfo: item }])
        break
      case 'add':
        listMusicAddRef.current?.show({ musicInfo: item, listId: '', isMove: false })
        break
      case 'removeRecord':
        removeRecentPlay(item)
        setList(prev => prev.filter(p => !(p.musicInfo.source == item.source && p.musicInfo.id == item.id)))
        break
    }
  }, [handlePlay])

  return (
    <PageContent>
      <AnimatedFlatList
        style={styles.list}
        contentContainerStyle={{ paddingTop: statusBarHeight + SCREEN_HEADER_HEIGHT, paddingBottom: bottomInset }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        data={list}
        keyExtractor={item => `${item.musicInfo.source}__${item.musicInfo.id}`}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => {
          // 下载曲以 local 形态入最近播放时按原曲在线身份判勾（题3 归一口径，代码审查 I-2-a）
          const identity = toOnlineIdentity(item.musicInfo)
          return (
            <ListItem
              item={item.musicInfo}
              index={index}
              rowInfo={{ rowNum: undefined, rowWidth: '100%' }}
              selectedList={[]}
              showIndex={false}
              showCover
              showSource={false}
              showInterval
              isLiked={likedSet.has(item.musicInfo.id)}
              downloaded={downloadedSet.has(downloadedAction.getDownloadedKey(identity.source, identity.id))}
              onLikePress={toggleLike}
              onPress={(_, pressIndex) => { void handlePlay(pressIndex) }}
              onLongPress={(pressedItem, pressIndex) => { showMenu(pressedItem, pressIndex) }}
              onShowMenu={showMenu}
            />
          )
        }}
        ListEmptyComponent={EmptyList}
        showsVerticalScrollIndicator={false}
      />
      {/* 悬浮头后声明（RN 后声明者在上，C-1 层级修复）；无子头无大标题→标题常显（2026-10-23 判据修订拍板 #6） */}
      <ScreenHeader componentId={componentId} title={t('recent_play')} progress={scrollY} alwaysShowTitle />
      <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} />
      <ListMusicAdd ref={listMusicAddRef} />
      <PlayerBarPlaceholder />
    </PageContent>
  )
}

const EmptyList = () => {
  const t = useI18n()
  const theme = useTheme()
  return (
    <View style={styles.empty}>
      <Text size={13} color={theme['c-font-label']}>{t('recent_play_empty')}</Text>
    </View>
  )
}

const styles = createStyle({
  list: {
    flex: 1,
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
})
