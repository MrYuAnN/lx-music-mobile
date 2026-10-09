import { useCallback, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { getRecentPlayList, type RecentPlayItem } from '@/core/player/recentPlay'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

const ITEM_HEIGHT = scaleSizeH(56)
const RECENT_TEMP_LIST_ID = 'recent__play'

export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const theme = useTheme()
  // 挂载快照：浏览期间不实时重排（对齐业界「退出再进看到新顺序」），点击播放用快照索引
  const [list] = useState<RecentPlayItem[]>(() => [...getRecentPlayList()])

  const handlePlay = useCallback(async(index: number) => {
    // 与搜索歌单试听同模式：最近播放列表注入临时列表播放
    const musicInfos = list.map(item => item.musicInfo)
    await setTempList(RECENT_TEMP_LIST_ID, musicInfos as LX.Music.MusicInfoOnline[])
    void playList(LIST_IDS.TEMP, index)
  }, [list])

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('recent_play')} />
      <FlatList
        style={styles.list}
        data={list}
        keyExtractor={item => `${item.musicInfo.source}__${item.musicInfo.id}`}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => { void handlePlay(index) }}>
            <Text style={styles.index} size={13} color={theme['c-font-label']} numberOfLines={1}>{index + 1}</Text>
            <View style={styles.info}>
              <Text size={15} color={theme['c-font']} numberOfLines={1}>{item.musicInfo.name}</Text>
              <Text size={12} color={theme['c-font-label']} numberOfLines={1}>{item.musicInfo.singer}</Text>
            </View>
            {
              item.musicInfo.interval
                ? <Text size={12} color={theme['c-font-label']}>{item.musicInfo.interval}</Text>
                : null
            }
            <Icon name="play-outline" size={16} color={theme['c-font-label']} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text size={13} color={theme['c-font-label']}>{t('recent_play_empty')}</Text>
          </View>
        )}
      />
      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
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
  index: {
    width: scaleSizeW(24),
  },
  info: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
})
