import { FlatList, TouchableOpacity, View } from 'react-native'
import { useMemo } from 'react'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { useRecentPlayList } from '@/core/player/recentPlay'
import { setTempList, setActiveList } from '@/core/list'
import { playList } from '@/core/player/player'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import Text, { FontFamilies } from '@/components/common/Text'

// AM-2 首页内容：快捷四宫格（本地音乐/下载/榜单/歌单）
// + 最近播放 shelf（临时列表播放，与搜索歌单试听同模式）+ 我的列表区

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
    <View style={styles.quickNav}>
      {
        items.map(({ id, icon, action }) => (
          <TouchableOpacity key={id} style={{ ...styles.tile, backgroundColor: theme['c-content-background'] }} activeOpacity={0.6} onPress={action}>
            <Icon name={icon} size={24} color={theme['c-primary']} />
            <Text style={styles.tileLabel} size={13} color={theme['c-font']} numberOfLines={1}>{t(id)}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )
}

const RecentPlayShelf = () => {
  const theme = useTheme()
  const t = useI18n()
  const recentAll = useRecentPlayList()
  const list = useMemo(() => recentAll.slice(0, 30), [recentAll])

  const handlePlay = async(index: number) => {
    const musicInfos = list.map(item => item.musicInfo)
    await setTempList(storageDataPrefix.TEMP_LIST_RECENT, musicInfos)
    void playList(LIST_IDS.TEMP, index)
  }

  if (!list.length) {
    const componentId = commonState.componentIds.home
    return (
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle} size={20} color={theme['c-font']}>{t('home_recent_play')}</Text>
          {
            componentId
              ? <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} onPress={() => { navigations.pushRecentPlayScreen(componentId) }}>
                  <Text size={13} color={theme['c-font-label']}>{t('more')}</Text>
                  <Icon name="chevron-right" size={12} color={theme['c-font-label']} />
                </TouchableOpacity>
              : null
          }
        </View>
        <Text style={styles.sectionEmpty} size={13} color={theme['c-font-label']}>{t('home_recent_play_empty')}</Text>
      </View>
    )
  }

  const componentId = commonState.componentIds.home
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle} size={20} color={theme['c-font']}>{t('home_recent_play')}</Text>
        {
          componentId
            ? <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} onPress={() => { navigations.pushRecentPlayScreen(componentId) }}>
                <Text size={13} color={theme['c-font-label']}>{t('more')}</Text>
                <Icon name="chevron-right" size={12} color={theme['c-font-label']} />
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
              url={(item.musicInfo.meta as { pic?: string }).pic ?? null}
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

const MyLists = () => {
  const theme = useTheme()
  const t = useI18n()
  const lists = useMyList()

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} size={20} color={theme['c-font']}>{t('nav_love')}</Text>
      <View style={{ ...styles.listCard, backgroundColor: theme['c-content-background'] }}>
        {
          lists.map(list => (
            <TouchableOpacity
              key={list.id}
              style={styles.listItem}
              activeOpacity={0.6}
              onPress={() => {
                const componentId = commonState.componentIds.home
                if (!componentId) return
                setActiveList(list.id)
                navigations.pushMylistScreen(componentId)
              }}
            >
              <Icon name="music" size={18} color={theme['c-primary']} />
              <Text style={styles.listItemName} size={15} color={theme['c-font']} numberOfLines={1}>{list.name}</Text>
              <Icon name="chevron-right" size={14} color={theme['c-font-label']} />
            </TouchableOpacity>
          ))
        }
      </View>
    </View>
  )
}

export default () => {
  return (
    <>
      <QuickNav />
      <RecentPlayShelf />
      <MyLists />
    </>
  )
}

const styles = createStyle({
  quickNav: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  tile: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tileLabel: {
    fontFamily: FontFamilies.medium,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 12,
    fontFamily: FontFamilies.semibold,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionEmpty: {
    paddingHorizontal: 16,
  },
  shelfContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  shelfItem: {
    width: 108,
  },
  shelfCover: {
    width: 108,
    height: 108,
    borderRadius: 10,
    marginBottom: 6,
  },
  shelfName: {
    marginBottom: 2,
  },
  listCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listItemName: {
    flex: 1,
  },
})
