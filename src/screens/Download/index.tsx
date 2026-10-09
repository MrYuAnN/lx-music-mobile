import { useEffect } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import PlayerBar from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useDownloadList, pauseDownload, resumeDownload, retryDownload, removeDownload, clearCompleted } from '@/core/music/download'
import { createStyle } from '@/utils/tools'
import { requestStoragePermission } from '@/utils/permissions'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

const ITEM_HEIGHT = scaleSizeH(64)

export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const theme = useTheme()
  const list = useDownloadList()

  useEffect(() => {
    void requestStoragePermission()
  }, [])

  const downloading = list.filter(l => !l.isComplate)
  const completed = list.filter(l => l.isComplate)

  // statusText 存 i18n key（如获取地址中）或原始错误信息，t() 对非 key 原样返回
  const getStatusText = (item: LX.Download.ListItem) => {
    switch (item.status) {
      case 'run':
        return item.statusText ? t(item.statusText as never) : `${Math.floor(item.progress)}%`
      case 'waiting':
        return t('download_status_waiting')
      case 'pause':
        return t('download_status_paused')
      case 'error':
        return item.statusText || t('download_status_failed')
      default:
        return ''
    }
  }

  const renderItem = ({ item }: { item: LX.Download.ListItem }) => {
    const isRunning = item.status == 'run'
    return (
      <View style={styles.item}>
        <View style={styles.info}>
          <Text size={15} color={theme['c-font']} numberOfLines={1}>{item.metadata.musicInfo.name}</Text>
          {
            isRunning
              ? (
                  <View style={styles.progressInfo}>
                    <View style={{ ...styles.progressTrack, backgroundColor: theme['c-primary-light-400-alpha-900'] }}>
                      <View style={{ ...styles.progressFill, width: `${item.progress}%`, backgroundColor: theme['c-primary'] }} />
                    </View>
                    <Text size={11} color={theme['c-font-label']}>{Math.floor(item.progress)}%</Text>
                  </View>
                )
              : (
                  <Text size={12} color={item.status == 'error' ? '#e0544b' : theme['c-font-label']} numberOfLines={1}>
                    {item.metadata.musicInfo.singer}
                    {getStatusText(item) ? ` · ${getStatusText(item)}` : ''}
                  </Text>
                )
          }
        </View>
        <View style={styles.actions}>
          {
            item.status == 'run'
              ? (
                  <TouchableOpacity onPress={() => { pauseDownload(item.id) }} style={styles.actionBtn}>
                    <Icon name="pause" size={16} color={theme['c-font']} />
                  </TouchableOpacity>
                )
              : null
          }
          {
            item.status == 'pause'
              ? (
                  <TouchableOpacity onPress={() => { resumeDownload(item.id) }} style={styles.actionBtn}>
                    <Icon name="play-outline" size={16} color={theme['c-font']} />
                  </TouchableOpacity>
                )
              : null
          }
          {
            item.status == 'error'
              ? (
                  <TouchableOpacity onPress={() => { retryDownload(item.id) }} style={styles.actionBtn}>
                    <Text size={13} color={theme['c-primary']}>{t('download_retry')}</Text>
                  </TouchableOpacity>
                )
              : null
          }
          <TouchableOpacity onPress={() => { removeDownload(item.id) }} style={styles.actionBtn}>
            <Icon name="remove" size={16} color={theme['c-font-label']} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('download_manage')} right={
        completed.length
          ? (
              <TouchableOpacity onPress={clearCompleted}>
                <Text size={13} color={theme['c-font-label']}>{t('download_clear_completed')}</Text>
              </TouchableOpacity>
            )
          : undefined
      } />
      <FlatList
        style={styles.list}
        data={[...downloading, ...completed]}
        keyExtractor={item => `${item.metadata.musicInfo.source}__${item.metadata.musicInfo.id}`}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text size={13} color={theme['c-font-label']}>{t('download_list_empty')}</Text>
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
    paddingRight: 8,
    gap: 8,
  },
  info: {
    flex: 1,
    flexShrink: 1,
    gap: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: scaleSizeW(8),
    paddingVertical: scaleSizeH(8),
  },
  empty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
})
