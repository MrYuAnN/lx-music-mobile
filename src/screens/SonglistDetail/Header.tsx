import { forwardRef, useRef, useState, useImperativeHandle } from 'react'
import { View } from 'react-native'

import PlaylistHeader from '@/components/common/PlaylistHeader'
import { useCoverFlyTarget } from '@/navigation/transitions/coverFly'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useMyList } from '@/store/list/hook'
import songlistState from '@/store/songlist/state'
import commonState from '@/store/common/state'
import { pop } from '@/navigation'
import { useI18n } from '@/lang'
import { handleCollect, handlePlay, handlePlayShuffle } from './listAction'
import { useListInfo } from './state'
import { createStyle, toast } from '@/utils/tools'

// 歌单页重构批②c：在线歌单详情页新头部（与本地歌单页同构 PlaylistHeader）。
// coverFly 封面飞入转场保留：目标测量容器=本头部根 View（原结构同款，容器矩形运行时测得）
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
  const containerRef = useRef<View>(null)
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', imgUrl: info.img })
  const fly = useCoverFlyTarget(info.id, containerRef)

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  // 已收藏态（审查 S1）：○+ 显示 ✓（love-fill），点击仍走 handleCollect 的查重转同步确认
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

  return (
    <View ref={containerRef} style={styles.container} pointerEvents="box-none">
      <PlaylistHeader
        title={detailInfo.name || info.name}
        subtitle={subtitle}
        pic={detailInfo.imgUrl}
        desc={detailInfo.desc || undefined}
        collected={collected}
        thirdAction="collect"
        showBack
        onBack={() => { pop(commonState.componentIds.songlistDetail) }}
        onPlay={() => {
          if (!songlistState.listDetailInfo.info.name) return
          void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
        }}
        onShuffle={() => {
          if (!songlistState.listDetailInfo.info.name) return
          handlePlayShuffle(info.id, info.source).catch(() => { toast(t('list_error')) })
        }}
        onThird={() => {
          if (!songlistState.listDetailInfo.info.name) return
          void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name, songlistState.listDetailInfo.info.img)
        }}
        coverContainerRef={fly.ref}
        coverOnLayout={fly.onLayout}
        coverNativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`}
        coverSettled={fly.settled}
        coverImageStyle={fly.imageStyle}
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
