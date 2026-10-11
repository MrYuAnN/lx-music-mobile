import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, FlatList, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import ActionSheet, { type ActionSheetType, type ActionSheetItem } from '@/components/common/ActionSheet'
import CategoryChips from '@/components/common/CategoryChips'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import ListItem, { ITEM_HEIGHT } from '@/components/OnlineList/ListItem'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useLikedSet, useLikeToggle } from '@/store/list/hook'
import {
  initDownloadList, getDownloadListSnapshot, pauseDownloadTask, resumeDownloadTask,
  removeDownloadTask, addDownloadTask, revalidateWifiWaiting, toDownloadedMusicInfo, pump,
} from '@/core/download'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS, storageDataPrefix, ICON_SIZE } from '@/config/constant'
import { qualityLabel as formatQuality } from '@/utils/music'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

type TabId = 'running' | 'waiting' | 'error' | 'completed'

const TABS: readonly TabId[] = ['running', 'waiting', 'error', 'completed']

const TASK_ROW_HEIGHT = scaleSizeH(68)
// 空态装饰大图标（原型屏4 骨架；ICON_SIZE 无此档，空态一次性尺寸）
const EMPTY_ICON_SIZE = 54

// 下载管理页（multifix 问题 4 §5.4）：四 chips 带计数，行态=进行中(进度条+暂停/已暂停+继续)/
// 排队中(取消)/失败(重试)/已完成(统一行)；进页恢复任务表+重查 Wi-Fi 挂起+续跑未完成任务
export default ({ componentId }: { componentId: string }) => {
  void componentId
  const t = useI18n()
  const likedSet = useLikedSet()
  const toggleLike = useLikeToggle()
  const [tasks, setTasks] = useState<LX.Download.ListItem[]>(() => getDownloadListSnapshot())
  const [tab, setTab] = useState<TabId>('running')
  const menuRef = useRef<ActionSheetType>(null)
  const [menuVisible, setMenuVisible] = useState(false)
  const [menus, setMenus] = useState<ActionSheetItem[]>([])
  const selectedRef = useRef<LX.Download.ListItem | null>(null)

  useEffect(() => {
    // 进页恢复任务表 + 重查 Wi-Fi 挂起（审查 I5：前台网络切换无回调，重进页面是恢复路径之一）
    // + 续跑未完成任务（引擎不随启动自动跑，避免后台静默流量）
    void initDownloadList().then(() => {
      setTasks(getDownloadListSnapshot())
      void revalidateWifiWaiting()
      pump()
    })
  }, [])

  useEffect(() => {
    const handleChanged = (list: LX.Download.ListItem[]) => { setTasks(list) }
    const handleProgress = () => {
      // 进度节流后整表刷新（TaskRow 按原始值 props 感知变化，审查 C4）
      setTasks(getDownloadListSnapshot())
    }
    global.state_event.on('downloadStateChanged', handleChanged)
    global.state_event.on('downloadProgress', handleProgress)
    return () => {
      global.state_event.off('downloadStateChanged', handleChanged)
      global.state_event.off('downloadProgress', handleProgress)
    }
  }, [])

  // 回前台：重查 Wi-Fi 挂起任务（关移动网络下载场景）
  useEffect(() => {
    const handleChange = (state: string) => {
      if (state != 'active') return
      void revalidateWifiWaiting()
    }
    const subscription = AppState.addEventListener('change', handleChange)
    return () => { subscription.remove() }
  }, [])

  const isTabOf = useCallback((task: LX.Download.ListItem, id: TabId) => {
    switch (id) {
      case 'running': return task.status == 'run' || task.status == 'pause' // 暂停并入进行中（审查 C5）
      case 'waiting': return task.status == 'waiting'
      case 'error': return task.status == 'error'
      default: return task.status == 'completed'
    }
  }, [])

  const tabs = useMemo(() => {
    return TABS.map(id => ({
      id,
      label: t(`download_tab_${id}`),
      count: tasks.filter(task => isTabOf(task, id)).length,
    }))
  }, [tasks, t, isTabOf])

  const filtered = useMemo(() => {
    return tasks.filter(task => isTabOf(task, tab))
  }, [tasks, tab, isTabOf])

  // 已完成行：统一歌曲行数据（音质标签按实际下载档）
  const completedItems = useMemo(() => {
    return filtered.filter(task => task.status == 'completed').map(task => {
      const qualityOverride: LX.Music._MusicQualityType = { [task.metadata.quality]: { size: null } }
      return {
        task,
        musicInfo: toDownloadedMusicInfo(task),
        qualityOverride,
      }
    })
  }, [filtered])

  const completedList = useMemo(() => completedItems.map(item => item.musicInfo), [completedItems])

  // 菜单按任务状态裁剪（审查 I3）：未完成任务的 filePath 为空，播放必走错
  const buildMenus = (task: LX.Download.ListItem): ActionSheetItem[] => {
    if (task.status == 'completed') {
      return [
        { action: 'play', label: t('play'), icon: 'play' },
        { action: 'replay', label: t('download_redownload'), icon: 'download-2' },
        { action: 'delete', label: t('download_delete'), icon: 'trash', destructive: true },
      ]
    }
    return [
      { action: 'retry', label: t('download_retry'), icon: 'history' },
      { action: 'delete', label: t('download_delete'), icon: 'trash', destructive: true },
    ]
  }

  const showTaskMenu = useCallback((task: LX.Download.ListItem) => {
    selectedRef.current = task
    setMenus(buildMenus(task))
    if (menuVisible) menuRef.current?.show()
    else {
      setMenuVisible(true)
      requestAnimationFrame(() => {
        menuRef.current?.show()
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- buildMenus 依赖 t，show 时现构造
  }, [menuVisible, t])

  const handleMenuPress = useCallback(({ action }: ActionSheetItem) => {
    const task = selectedRef.current
    if (!task) return
    switch (action) {
      case 'play': {
        const musicInfo = toDownloadedMusicInfo(task)
        void setTempList(storageDataPrefix.TEMP_LIST_LOCAL, [musicInfo]).then(() => {
          void playList(LIST_IDS.TEMP, 0)
        })
        break
      }
      case 'replay': {
        // 重新下载：清记录后按原歌曲重新入队
        const musicInfo = task.metadata.musicInfo
        void removeDownloadTask(task.id).then(async() => addDownloadTask(musicInfo))
        break
      }
      case 'retry':
        resumeDownloadTask(task.id)
        break
      case 'delete':
        void removeDownloadTask(task.id)
        break
    }
  }, [])

  const handleCompletedPress = useCallback((musicInfo: LX.Music.MusicInfoLocal, list: LX.Music.MusicInfoLocal[]) => {
    void setTempList(storageDataPrefix.TEMP_LIST_LOCAL, list).then(() => {
      const index = list.findIndex(m => m.id == musicInfo.id)
      if (index > -1) void playList(LIST_IDS.TEMP, index)
    })
  }, [])

  return (
    <PageContent>
      <ScreenHeader componentId={componentId} title={t('nav_download')} />
      <View style={styles.chips}>
        <CategoryChips items={tabs} activeId={tab} onChange={id => { setTab(id as TabId) }} />
      </View>
      {
        tab == 'completed'
          ? (
              <FlatList
                style={styles.list}
                data={completedItems}
                keyExtractor={({ task }) => task.id}
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
                    qualityOverride={item.qualityOverride}
                    isLiked={likedSet.has(item.musicInfo.id)}
                    onLikePress={toggleLike}
                    onPress={(_, pressIndex) => { handleCompletedPress(completedList[pressIndex], completedList) }}
                    onLongPress={() => { showTaskMenu(item.task) }}
                    onShowMenu={() => { showTaskMenu(item.task) }}
                  />
                )}
                ListEmptyComponent={<EmptyList tab={tab} />}
              />
            )
          : (
              <FlatList
                style={styles.list}
                data={filtered}
                keyExtractor={task => task.id}
                getItemLayout={(_, index) => ({ length: TASK_ROW_HEIGHT, offset: TASK_ROW_HEIGHT * index, index })}
                renderItem={({ item }) => (
                  <TaskRow
                    // 原始值 props 驱动重渲染：引擎原地改 task 对象、memo 浅比较不再冻结（审查 C4）
                    id={item.id}
                    name={item.metadata.musicInfo.name}
                    status={item.status}
                    progress={item.progress}
                    statusText={item.statusText}
                    speed={item.speed}
                    onAction={handleTaskAction}
                    onMenu={showTaskMenu}
                  />
                )}
                ListEmptyComponent={<EmptyList tab={tab} />}
              />
            )
      }
      {
        menuVisible
          ? <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} onHide={() => { setMenuVisible(false) }} />
          : null
      }
      <PlayerBarPlaceholder />
    </PageContent>
  )
}

// 行操作直接动作（审查 I3：排队行取消、失败行重试均为一步动作，不再弹通用菜单）
const handleTaskAction = (task: LX.Download.ListItem) => {
  if (task.status == 'run') pauseDownloadTask(task.id)
  else if (task.status == 'pause') resumeDownloadTask(task.id)
  else if (task.status == 'error') resumeDownloadTask(task.id)
  else if (task.status == 'waiting') void removeDownloadTask(task.id)
}

// 进行中（含已暂停）/排队中/失败 行（68 高：封面占位 + 歌名 + 状态副行 [+ 进度条] + 操作钮）；
// 原始值 props（审查 C4）
const TaskRow = memo(({ id, name, status, progress, statusText, speed, onAction, onMenu }: {
  id: string
  name: string
  status: LX.Download.DownloadTaskStatus
  progress: number
  statusText: string
  speed: string
  onAction: (task: LX.Download.ListItem) => void
  onMenu: (task: LX.Download.ListItem) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const taskRef = useRef(getDownloadListSnapshot().find(task => task.id == id))
  taskRef.current = getDownloadListSnapshot().find(task => task.id == id)

  const label = status == 'run'
    ? `${statusText || `${formatQuality(taskRef.current?.metadata.quality ?? '320k', t)} · ${progress}%`}${speed ? ` · ${speed}` : ''}`
    : status == 'pause'
      ? t('download_paused')
      : statusText || t(`download_tab_${status == 'error' ? 'error' : 'waiting'}`)

  const actionIcon = status == 'run'
    ? 'pause'
    : status == 'error'
      ? 'history'
      : status == 'pause' ? 'play' : 'close'

  return (
    <View style={styles.taskRow}>
      <View style={{ ...styles.taskPic, backgroundColor: theme['c-border-background'] }}>
        <Icon name="music" size={ICON_SIZE.list} color={theme['c-font-label']} />
      </View>
      <View style={styles.taskInfo}>
        <Text size={15} numberOfLines={1}>{name}</Text>
        <Text
          size={12}
          color={status == 'error' ? theme['c-primary'] : theme['c-font-label']}
          numberOfLines={1}
        >{label}</Text>
        {
          status == 'run'
            ? (
                <View style={{ ...styles.progressTrack, backgroundColor: theme['c-border-background'] }}>
                  <View style={{ ...styles.progressFill, width: `${progress}%`, backgroundColor: theme['c-primary'] }} />
                </View>
              )
            : null
        }
      </View>
      <TouchableOpacity
        style={styles.taskAction}
        activeOpacity={0.6}
        accessibilityLabel={t(`download_${status == 'error' ? 'retry' : status == 'pause' ? 'resume' : status == 'waiting' ? 'delete' : 'pause'}`)}
        onPress={() => { if (taskRef.current) onAction(taskRef.current) }}
        onLongPress={() => { if (taskRef.current) onMenu(taskRef.current) }}
      >
        <Icon
          name={actionIcon}
          size={status == 'pause' ? ICON_SIZE.inline : ICON_SIZE.list}
          color={status == 'error' ? theme['c-primary'] : theme['c-font-label']}
        />
      </TouchableOpacity>
    </View>
  )
})

// 空态（问题 3 空态骨架：大图标 + 文案，原型屏4）
const EmptyList = ({ tab }: { tab: TabId }) => {
  const t = useI18n()
  const theme = useTheme()
  return (
    <View style={styles.empty}>
      <Icon name="download-2" size={EMPTY_ICON_SIZE} color={theme['c-300']} />
      <Text size={13} color={theme['c-font-label']}>{t(`download_empty_${tab}`)}</Text>
    </View>
  )
}

const styles = createStyle({
  chips: {
    paddingTop: SPACING.s8,
    paddingBottom: SPACING.s2,
  },
  list: {
    flex: 1,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TASK_ROW_HEIGHT,
    paddingLeft: 16,
    paddingRight: 8,
  },
  taskPic: {
    width: scaleSizeW(40),
    height: scaleSizeW(40),
    borderRadius: scaleSizeW(6),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.s12,
  },
  taskInfo: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
    marginRight: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    marginTop: SPACING.s4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  taskAction: {
    width: 36,
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
})
