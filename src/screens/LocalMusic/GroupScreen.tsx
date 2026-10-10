import { useCallback, useRef } from 'react'
import { FlatList } from 'react-native'

import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import LocalMusicMenu, { type LocalMusicMenuType } from './LocalMusicMenu'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useLikedSet, useLikeToggle } from '@/store/list/hook'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'
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
  const menuRef = useRef<LocalMusicMenuType>(null)

  const handlePlay = useCallback((item: LX.Music.MusicInfoLocal, playList_: LX.Music.MusicInfoLocal[]) => {
    // 本地歌与在线歌共用临时列表播放链（播放器按 source 分流取 URL）
    void setTempList(storageDataPrefix.TEMP_LIST_LOCAL, playList_).then(() => {
      const index = playList_.findIndex(m => m.id == item.id)
      if (index > -1) void playList(LIST_IDS.TEMP, index)
    })
  }, [])

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={value} />
      <FlatList
        style={styles.list}
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
            isShowAlbumName={false}
            isLiked={likedSet.has(item.id)}
            onLikePress={toggleLike}
            onPress={(_, pressIndex) => { handlePlay(list[pressIndex], list) }}
            onLongPress={pressedItem => { menuRef.current?.show(pressedItem as LX.Music.MusicInfoLocal, list) }}
            onShowMenu={itemInfo => { menuRef.current?.show(itemInfo as LX.Music.MusicInfoLocal, list) }}
          />
        )}
      />
      <LocalMusicMenu ref={menuRef} />
      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
  list: {
    flex: 1,
  },
})
