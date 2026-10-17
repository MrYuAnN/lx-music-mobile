import { forwardRef, useState, useImperativeHandle } from 'react'
import { View } from 'react-native'

import PlaylistHeader from '@/components/common/PlaylistHeader'
import { useMyList } from '@/store/list/hook'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import listState from '@/store/list/state'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { togglePlay } from '@/core/player/player'
import { handleCollect, handlePlay, handlePlayShuffle, getListId } from './listAction'
import { useListInfo } from './state'
import { LIST_IDS } from '@/config/constant'
import { createStyle, toast } from '@/utils/tools'

// 歌单页重构批②c：在线歌单详情页头部（与本地歌单页同构 PlaylistHeader）。
// hero v2（QQ 式融合）：无独立封面落点，封面飞入转场停用（D3，普通 push 转场）
export interface HeaderProps {
  componentId: string
}

export interface HeaderType {
  setInfo: (info: DetailInfo) => void
}
export interface DetailInfo {
  name: string
  desc: string
  imgUrl?: string
}

const formatDate = (time: number) => {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default forwardRef<HeaderType, HeaderProps>(({ componentId }, ref) => {
  const t = useI18n()
  const info = useListInfo()
  const lists = useMyList()
  const isPlay = useIsPlay()
  const playMusicInfo = usePlayMusicInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', imgUrl: info.img })

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  // 已收藏态（审查 S1）：♥ 实心/空心 toggle，点击仍走 handleCollect 的查重转同步确认
  const collectedInfo = lists.find(l => (l as LX.List.UserListInfo).source == info.source && (l as LX.List.UserListInfo).sourceListId == info.id) as LX.List.UserListInfo | undefined
  const collected = !!collectedInfo
  const sourceName = info.source ? t(`source_real_${info.source}` as never) : ''
  const subtitle = collectedInfo
    ? (collectedInfo.collectTime
        ? t('list_collected_sub', { source: sourceName, date: formatDate(collectedInfo.collectTime) })
        : sourceName)
    // 未收藏浏览态：AM 头部元信息行对标（审查 PM-I3），显示歌曲总数
    : (songlistState.listDetailInfo.total
        ? t('music_count', { count: songlistState.listDetailInfo.total })
        : undefined)

  // 主胶囊两态判定（AM 语义，审查 I-D）：在线歌单播的是 TEMP 队列，须再比对队列元 id
  const playingThisList = isPlay &&
    playMusicInfo.listId == LIST_IDS.TEMP &&
    listState.tempListMeta.id == getListId(info.id, info.source)

  return (
    <View style={styles.container} pointerEvents="box-none">
      <PlaylistHeader
        title={detailInfo.name || info.name}
        subtitle={subtitle}
        // 占位判定用（I-D 装饰层）：异步回填前回退路由图，避免「有封面源却显示装饰层」闪变
        pic={detailInfo.imgUrl ?? info.img}
        desc={detailInfo.desc || undefined}
        collected={collected}
        showCollectHeart
        onCollectToggle={() => {
          if (!songlistState.listDetailInfo.info.name) return
          void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name, songlistState.listDetailInfo.info.img)
        }}
        playing={playingThisList}
        onTogglePlay={togglePlay}
        onPlay={() => {
          if (!songlistState.listDetailInfo.info.name) return
          void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
        }}
        onShufflePlay={() => {
          if (!songlistState.listDetailInfo.info.name) return
          handlePlayShuffle(info.id, info.source).catch(() => { toast(t('list_error')) })
        }}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'column',
    flexGrow: 0,
    flexShrink: 0,
  },
})
