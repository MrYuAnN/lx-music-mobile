import { useCallback, useRef, useState } from 'react'
import { FlatList, View } from 'react-native'

import Text from '@/components/common/Text'
import ActionSheet, { type ActionSheetType, type ActionSheetItem } from '@/components/common/ActionSheet'
import ListMusicAdd, { type MusicAddModalType } from '@/components/MusicAddModal'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { getRecentPlayList, removeRecentPlay, type RecentPlayItem } from '@/core/player/recentPlay'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { useLikedSet, useLikeToggle } from '@/store/list/hook'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import { createStyle } from '@/utils/tools'

const RECENT_TEMP_LIST_ID = storageDataPrefix.TEMP_LIST_RECENT

// 最近播放（问题 1 §2.6）：统一歌曲行（封面行首、无序号、行尾菜单）；
// 挂载快照不重排（浏览期间不实时重排，点击播放用快照索引），快照注入临时列表播放；
// 显式删除记录例外——就地移除该行（快照语义仅豁免播放自动新增）
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const [list, setList] = useState<RecentPlayItem[]>(() => [...getRecentPlayList()])
  const likedSet = useLikedSet()
  const toggleLike = useLikeToggle()
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
      <ScreenHeader componentId={componentId} title={t('recent_play')} />
      <FlatList
        style={styles.list}
        data={list}
        keyExtractor={item => `${item.musicInfo.source}__${item.musicInfo.id}`}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => (
          <ListItem
            item={item.musicInfo}
            index={index}
            rowInfo={{ rowNum: undefined, rowWidth: '100%' }}
            selectedList={[]}
            showIndex={false}
            showCover
            showSource={false}
            showInterval
            isShowAlbumName={false}
            isLiked={likedSet.has(item.musicInfo.id)}
            onLikePress={toggleLike}
            onPress={(_, pressIndex) => { void handlePlay(pressIndex) }}
            onLongPress={(pressedItem, pressIndex) => { showMenu(pressedItem, pressIndex) }}
            onShowMenu={showMenu}
          />
        )}
        ListEmptyComponent={EmptyList}
      />
      <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} />
      <ListMusicAdd ref={listMusicAddRef} />
      <PlayerBar />
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
