import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, TextInput, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { scanLocalMusic, useLocalMusicList, useLocalMusicScanning, toMusicInfoLocal, formatInterval, type LocalMusicItem } from '@/core/localMusic'
import { addListMusics, setTempList } from '@/core/list'
import settingState from '@/store/setting/state'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { createStyle, toast } from '@/utils/tools'
import { requestStoragePermission } from '@/utils/permissions'
import { scaleSizeH } from '@/utils/pixelRatio'

const ITEM_HEIGHT = scaleSizeH(56)

// 本地音乐（批次⑧）：白名单目录扫描（Music/Download 递归、.nomedia/录音目录跳过、碎片过滤），进页自动增量扫描
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const theme = useTheme()
  const list = useLocalMusicList()
  const scanning = useLocalMusicScanning()
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    // 首次扫描前申请存储权限（Android ≤9；10+ legacy 自动授予），拒绝时扫描仍执行但目录不可读呈现空态
    void requestStoragePermission().then(() => {
      void scanLocalMusic()
    })
  }, [])

  const filtered = useMemo(() => {
    if (!keyword) return list
    const kw = keyword.toLowerCase()
    return list.filter(item => item.name.toLowerCase().includes(kw) || item.singer.toLowerCase().includes(kw))
  }, [list, keyword])

  const handlePlay = useCallback(async(index: number) => {
    const musicInfos = filtered.map(item => toMusicInfoLocal(item))
    // 本地歌与在线歌共用临时列表播放链（播放器按 source 分流取 URL）
    await setTempList('local__play', musicInfos as unknown as LX.Music.MusicInfoOnline[])
    void playList(LIST_IDS.TEMP, index)
  }, [filtered])

  const handleCollect = useCallback((item: LocalMusicItem) => {
    void addListMusics(LIST_IDS.LOVE, [toMusicInfoLocal(item)], settingState.setting['list.addMusicLocationType'])
    toast(t('local_music_added_love'))
  }, [t])

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('local_music')} />
      <View style={styles.searchBar}>
        <Icon name="search-2" size={14} color={theme['c-font-label']} />
        <TextInput
          style={{ ...styles.searchInput, color: theme['c-font'] }}
          placeholder={t('nav_search')}
          placeholderTextColor={theme['c-font-label']}
          value={keyword}
          onChangeText={setKeyword}
        />
        <TouchableOpacity onPress={() => { void scanLocalMusic() }} disabled={scanning} style={styles.rescanBtn}>
          <Text size={13} color={scanning ? theme['c-font-label'] : theme['c-primary']}>{scanning ? t('local_music_scanning') : t('local_music_rescan')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={item => item.id}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => { void handlePlay(index) }}>
            <View style={styles.info}>
              <Text size={15} color={theme['c-font']} numberOfLines={1}>{item.name}</Text>
              <Text size={12} color={theme['c-font-label']} numberOfLines={1}>{item.singer || t('singer_unknown')} · {formatInterval(item.interval)}</Text>
            </View>
            <TouchableOpacity style={styles.collectBtn} onPress={() => { handleCollect(item) }}>
              <Icon name="love" size={16} color={theme['c-font-label']} />
            </TouchableOpacity>
            <Icon name="play-outline" size={16} color={theme['c-font-label']} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={EmptyList}
      />
      <PlayerBar />
    </PageContent>
  )
}

const EmptyList = () => {
  const t = useI18n()
  const theme = useTheme()
  return (
    <View style={styles.empty}>
      <Text size={13} color={theme['c-font-label']}>{t('local_music_empty')}</Text>
    </View>
  )
}

const styles = createStyle({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: scaleSizeH(38),
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
  },
  rescanBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 10,
  },
  info: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  collectBtn: {
    padding: 4,
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
})
