import { FlatList, TouchableOpacity, View, StyleSheet } from 'react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { allMusicList } from '@/utils/listManage'
import { useRecentPlayList } from '@/core/player/recentPlay'
import { setTempList, setActiveList } from '@/core/list'
import { playList } from '@/core/player/player'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { LIST_IDS, storageDataPrefix, ICON_SIZE } from '@/config/constant'
import Text, { FontFamilies } from '@/components/common/Text'
import CreateListDialog, { type CreateListDialogType } from '@/components/common/CreateListDialog'

// AM-6 首页内容（紧凑版）：规格源 .review-bundle/2026-10-10/home-proto.html（v-dense）。
// 尺寸脱离 scaleSize 体系（其 3.1 上限在高密度屏压缩尺寸导致比例失真），直接使用原型 dp 值
// （原型基准 390dp，现代设备 dp 宽 360~430，偏差 ±7% 内，天然动态适配）。
// 图标尺寸走 ICON_SIZE 语义 token（裸 dp，见 constant.ts）；文字沿用 Text 组件（setSpText，保留用户字号设置）。

const isCollectList = (info: LX.List.MyListInfo): boolean => {
  return 'source' in info ? !!info.source : false
}

const QuickNav = () => {
  const theme = useTheme()
  const t = useI18n()

  const items: Array<{ id: 'nav_local_music' | 'nav_download' | 'nav_top' | 'nav_songlist', icon: string, action: () => void }> = [
    { id: 'nav_local_music', icon: 'folder-music', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushLocalMusicScreen(componentId) } },
    { id: 'nav_download', icon: 'download-2', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushDownloadScreen(componentId) } },
    { id: 'nav_top', icon: 'trophy', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushLeaderboardScreen(componentId) } },
    { id: 'nav_songlist', icon: 'album', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushSongListScreen(componentId) } },
  ]

  return (
    <View style={styles.quick}>
      {
        items.map(({ id, icon, action }) => (
          <TouchableOpacity key={id} style={{ ...styles.tile, backgroundColor: theme['c-content-background'] }} activeOpacity={0.6} onPress={action}>
            <Icon name={icon} size={ICON_SIZE.tile} color={theme['c-primary']} />
            <Text style={styles.tileLabel} size={14} color={theme['c-font']} numberOfLines={1}>{t(id)}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )
}

// 歌单封面：无封面数据的用户歌单按 id 稳定取一组渐变 + 音符标
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

const RecentPlayCard = () => {
  const theme = useTheme()
  const t = useI18n()
  const recentAll = useRecentPlayList()
  const list = useMemo(() => recentAll.slice(0, 30), [recentAll])

  const handlePlay = async(index: number) => {
    const musicInfos = list.map(item => item.musicInfo)
    await setTempList(storageDataPrefix.TEMP_LIST_RECENT, musicInfos)
    void playList(LIST_IDS.TEMP, index)
  }

  // 空态整块隐藏（含卡头，对标 AM/Spotify 空内容不显示区块；全量入口随之无必要）
  if (!list.length) return null

  const componentId = commonState.componentIds.home
  return (
    <View style={{ ...styles.section, ...styles.card, backgroundColor: theme['c-content-background'] }}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} size={17} color={theme['c-font']}>{t('home_recent_play')}</Text>
        {
          componentId
            ? <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} onPress={() => { navigations.pushRecentPlayScreen(componentId) }}>
                <Text size={13} color={theme['c-font-label']}>{t('more')}</Text>
                <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
              </TouchableOpacity>
            : null
        }
      </View>
      <FlatList
        horizontal
        data={list}
        keyExtractor={item => `${item.musicInfo.source}__${item.musicInfo.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelfContent}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.shelfItem} activeOpacity={0.6} onPress={() => { void handlePlay(index) }}>
            <Image
              style={{ ...styles.shelfCover, backgroundColor: theme['c-border-background'] }}
              url={(item.musicInfo.meta as { picUrl?: string }).picUrl ?? null}
              resizeMode="cover"
            />
            <Text style={styles.shelfName} size={13} color={theme['c-font']} numberOfLines={1}>{item.musicInfo.name}</Text>
            <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{item.musicInfo.singer}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const MyMusic = () => {
  const theme = useTheme()
  const t = useI18n()
  const lists = useMyList()
  const dialogRef = useRef<CreateListDialogType>(null)
  const [tab, setTab] = useState<'my' | 'collect'>('my')
  // 曲数读 allMusicList 内存 Map，两个事件到达时重渲染刷新
  const [, setMusicVersion] = useState(0)

  useEffect(() => {
    const bump = () => { setMusicVersion(v => v + 1) }
    global.state_event.on('mylistUpdated', bump)
    global.app_event.on('myListMusicUpdate', bump)
    return () => {
      global.state_event.off('mylistUpdated', bump)
      global.app_event.off('myListMusicUpdate', bump)
    }
  }, [])

  const getCount = useCallback((id: string) => allMusicList.get(id)?.length ?? 0, [])

  // 「我的歌单」= DEFAULT + userList(无 source)；「收藏歌单」= userList(有 source)；
  // LOVE 仅置顶红心行，不入 tab（方案 §3.7.2 [审查修订 C1]）
  const { myLists, collectLists } = useMemo(() => {
    const userLists = lists.slice(2)
    return {
      myLists: [lists[0], ...userLists.filter(l => !isCollectList(l))],
      collectLists: userLists.filter(isCollectList),
    }
  }, [lists])

  const openList = (id: string) => {
    const componentId = commonState.componentIds.home
    if (!componentId) return
    setActiveList(id)
    navigations.pushMylistScreen(componentId)
  }

  const currentLists = tab == 'my' ? myLists : collectLists

  return (
    <View style={{ ...styles.section, ...styles.card, backgroundColor: theme['c-content-background'] }}>
      <TouchableOpacity style={styles.loveRow} activeOpacity={0.6} onPress={() => { openList(LIST_IDS.LOVE) }}>
        <Icon name="love-fill" size={ICON_SIZE.emphasis} color={theme['c-primary']} />
        <Text style={styles.loveName} size={15} color={theme['c-font']} numberOfLines={1}>{t('list_name_love')}</Text>
        <Text size={13} color={theme['c-font-label']}>{t('music_count', { count: getCount(LIST_IDS.LOVE) })}</Text>
        <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
      </TouchableOpacity>
      <View style={[styles.sep, { backgroundColor: theme['c-border-background'] }]} />
      <View style={[styles.tabsRow, { borderBottomColor: theme['c-border-background'] }]}>
        <TouchableOpacity style={[styles.tabBtn, { borderBottomColor: tab == 'my' ? theme['c-primary'] : 'transparent' }]} activeOpacity={0.7} onPress={() => { setTab('my') }}>
          <Text size={15} color={tab == 'my' ? theme['c-primary'] : theme['c-font-label']}>{t('tab_my_lists')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, { borderBottomColor: tab == 'collect' ? theme['c-primary'] : 'transparent' }]} activeOpacity={0.7} onPress={() => { setTab('collect') }}>
          <Text size={15} color={tab == 'collect' ? theme['c-primary'] : theme['c-font-label']}>{t('tab_collect_lists')}</Text>
        </TouchableOpacity>
        {
          tab == 'my'
            ? <TouchableOpacity style={styles.addTab} activeOpacity={0.6} onPress={() => { dialogRef.current?.show() }}>
                <Icon name="plus" size={ICON_SIZE.control} color={theme['c-primary']} />
              </TouchableOpacity>
            : null
        }
      </View>
      <View style={styles.plist}>
        <CreateListDialog ref={dialogRef} />
        {
          currentLists.length
            ? currentLists.map(item => (
              <TouchableOpacity key={item.id} style={styles.listRow} activeOpacity={0.6} onPress={() => { openList(item.id) }}>
                <PlaylistCover id={item.id} size={48} />
                <View style={styles.listInfo}>
                  <Text size={15} color={theme['c-font']} numberOfLines={1}>{item.name}</Text>
                  <Text size={13} color={theme['c-font-label']} numberOfLines={1}>{t('music_count', { count: getCount(item.id) })}</Text>
                </View>
                <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
              </TouchableOpacity>
            ))
            : (
                <View style={styles.plistEmpty}>
                  <Text size={13} color={theme['c-font-label']}>{t(tab == 'collect' ? 'collect_list_empty' : 'list_empty')}</Text>
                </View>
              )
        }
      </View>
    </View>
  )
}

export default () => {
  return (
    <>
      <QuickNav />
      <RecentPlayCard />
      <MyMusic />
    </>
  )
}

// 原型 v-dense 1:1 dp 值（390 基准）
const styles = StyleSheet.create({
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    height: 68,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
  },
  tileLabel: {
    fontFamily: FontFamilies.semibold,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  card: {},
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardTitle: {
    fontFamily: FontFamilies.bold,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  shelfContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 12,
  },
  shelfItem: {
    width: 84,
  },
  shelfCover: {
    width: 84,
    height: 84,
    borderRadius: 10,
    marginBottom: 6,
  },
  shelfName: {
    marginBottom: 2,
    fontFamily: FontFamilies.semibold,
  },
  loveRow: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  loveName: {
    flex: 1,
    fontFamily: FontFamilies.semibold,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  tabBtn: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderBottomWidth: 2,
  },
  addTab: {
    position: 'absolute',
    right: 0,
    // 触区 44（AM-6 拍板），无底色不显形，仅扩大点击区
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plist: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  plistEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  listRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  listInfo: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  plCover: {
    borderRadius: 8,
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
