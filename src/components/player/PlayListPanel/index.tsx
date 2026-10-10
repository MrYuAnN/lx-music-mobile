import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Animated, FlatList, PanResponder, TouchableOpacity, View, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'

import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { sheetHandleStyles } from '@/components/common/ActionSheet'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { playListById } from '@/core/player/player'
import { getOrderedPlayList, moveQueueItem } from '@/core/player/queue'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { hapticImpactLight, hapticSelection } from '@/utils/haptic'

const ITEM_HEIGHT = scaleSizeH(56)
const PIC_SIZE = scaleSizeW(40)
const AUTO_SCROLL_EDGE = scaleSizeH(56)
const AUTO_SCROLL_SPEED = 6

export interface PlayListPanelType {
  show: () => void
}

const PlayListItem = memo(({ item, active, onPress, onArmDrag, onReleaseDrag }: {
  item: LX.Music.MusicInfo
  active: boolean
  onPress: () => void
  onArmDrag: () => void
  onReleaseDrag: () => void
}) => {
  const theme = useTheme()

  return (
    <View style={styles.item}>
      <TouchableOpacity style={styles.itemContent} onPress={onPress} activeOpacity={0.7}>
        <Image url={item.meta.picUrl} style={styles.itemPic} />
        <View style={styles.itemTexts}>
          <Text numberOfLines={1} size={15} color={active ? theme['c-primary'] : theme['c-font']}>{item.name}</Text>
          {
            item.singer
              ? <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{item.singer}</Text>
              : null
          }
        </View>
      </TouchableOpacity>
      {/* 触摸结束仍未进入拖拽即清登记，防 pressIndex 残留把后续滚动劫持为拖拽 */}
      <View style={styles.itemGrip} onTouchStart={onArmDrag} onTouchEnd={onReleaseDrag} onTouchCancel={onReleaseDrag}>
        <Icon name="menu" size={ICON_SIZE.inline} color={theme['c-font-label']} />
      </View>
    </View>
  )
})

interface DragInfo {
  index: number
  grabViewportY: number
  picUrl: string | number | null
  name: string
  singer: string
}

export default forwardRef<PlayListPanelType>((_, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const popupRef = useRef<PopupType>(null)
  const listRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const [visible, setVisible] = useState(false)
  const [list, setList] = useState<LX.Music.MusicInfo[]>([])
  // 当前播放曲（面板打开期间跟随切歌高亮）
  const playMusicInfo = usePlayMusicInfo()

  const listDataRef = useRef<LX.Music.MusicInfo[]>([])
  const listLayoutRef = useRef({ height: 0 })
  const scrollOffsetRef = useRef(0)
  // 拖拽手柄仲裁：onTouchStart 预登记按手柄的行号，移动时容器据此接管
  const dragStateRef = useRef({ pressIndex: -1, index: -1, grabViewportY: 0, viewportY: 0, active: false })
  const scrollDirRef = useRef(0)

  const [drag, setDrag] = useState<DragInfo | null>(null)
  const dragAnimY = useRef(new Animated.Value(0)).current

  const applyReorder = (from: number, to: number) => {
    const nextList = [...listDataRef.current]
    if (!nextList[from]) return
    nextList.splice(to, 0, nextList.splice(from, 1)[0])
    listDataRef.current = nextList
    setList(nextList)
    // 面板打开期间播放列表可能被后台切换，提交取实时 id（与拖拽开始快照不一致则由 syncQueue 兜底重建）
    moveQueueItem(playerState.playInfo.playerListId, from, to)
    hapticSelection()
  }

  // 悬停目标行（内容坐标：overlay 视口位置 + 滚动偏移，取行中心落点）；跨界即时换位
  const updateDropTarget = (viewportY: number) => {
    const centerContentY = viewportY + scrollOffsetRef.current
    const target = Math.min(Math.max(0, Math.floor(centerContentY / ITEM_HEIGHT)), listDataRef.current.length - 1)
    if (target != dragStateRef.current.index) {
      const from = dragStateRef.current.index
      dragStateRef.current.index = target
      applyReorder(from, target)
    }
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // 仅从拖拽手柄起手的移动由容器接管（普通行的滚动交还 FlatList）
    onMoveShouldSetPanResponder: () => dragStateRef.current.pressIndex >= 0 && !dragStateRef.current.active,
    onPanResponderGrant: () => {
      const pressIndex = dragStateRef.current.pressIndex
      const item = listDataRef.current[pressIndex]
      if (!item) return
      dragStateRef.current.active = true
      dragStateRef.current.index = pressIndex
      dragStateRef.current.grabViewportY = pressIndex * ITEM_HEIGHT + ITEM_HEIGHT / 2 - scrollOffsetRef.current
      dragStateRef.current.viewportY = dragStateRef.current.grabViewportY
      dragAnimY.setValue(dragStateRef.current.grabViewportY)
      hapticImpactLight()
      setDrag({
        index: pressIndex,
        grabViewportY: dragStateRef.current.grabViewportY,
        picUrl: item.meta.picUrl ?? null,
        name: item.name,
        singer: item.singer,
      })
    },
    onPanResponderMove: (_, g) => {
      if (!dragStateRef.current.active) return
      const viewportY = dragStateRef.current.grabViewportY + g.dy
      dragStateRef.current.viewportY = viewportY
      dragAnimY.setValue(viewportY)

      // 贴边自动滚动
      const listHeight = listLayoutRef.current.height
      scrollDirRef.current = viewportY < AUTO_SCROLL_EDGE
        ? -1
        : viewportY > listHeight - AUTO_SCROLL_EDGE ? 1 : 0

      updateDropTarget(viewportY)
    },
    onPanResponderRelease: () => { endDrag() },
    onPanResponderTerminate: () => { endDrag() },
  })).current

  const endDrag = useCallback(() => {
    if (!dragStateRef.current.active) return
    dragStateRef.current.active = false
    dragStateRef.current.pressIndex = -1
    scrollDirRef.current = 0
    setDrag(null)
  }, [])

  useEffect(() => {
    if (!drag) {
      scrollDirRef.current = 0
      return
    }
    let raf = 0
    const tick = () => {
      const dir = scrollDirRef.current
      if (dir != 0) {
        const nextOffset = Math.max(0, scrollOffsetRef.current + dir * AUTO_SCROLL_SPEED)
        listRef.current?.scrollToOffset({ offset: nextOffset, animated: false })
        // 自动滚动后内容滚过指尖，按最后悬浮位置复算落点（手指静止场景）
        updateDropTarget(dragStateRef.current.viewportY)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag])

  const refreshList = () => {
    const listId = playerState.playInfo.playerListId
    const nextList = listId ? (getOrderedPlayList(listId) as LX.Music.MusicInfo[]) : []
    listDataRef.current = nextList
    setList(nextList)
  }

  // 打开面板时定位到当前播放曲（国内系播放列表弹层惯例：全量列表+居中定位，区别于 AM 待播清单/Spotify 置顶队列）
  const scrollToActive = () => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    const listId = playerState.playInfo.playerListId
    if (!musicInfo || !listId) return
    const ordered = getOrderedPlayList(listId) as LX.Music.MusicInfo[]
    const idx = ordered.findIndex(m => m.id == musicInfo.id)
    if (idx > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: false })
      })
    }
  }

  useImperativeHandle(ref, () => ({
    show() {
      refreshList()
      if (visible) {
        popupRef.current?.setVisible(true)
        scrollToActive()
      } else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
          scrollToActive()
        })
      }
    },
  }))

  const handlePress = useCallback((item: LX.Music.MusicInfo) => {
    const listId = playerState.playInfo.playerListId
    if (!listId) return
    void playListById(listId, item.id)
  }, [])

  // 队列不可见（下载列表/临时榜单缓存丢失）与无队列两种空态区分，避免「正在播放却提示暂无播放列表」的矛盾
  const isPlaying = !!playMusicInfo.musicInfo

  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfo, index: number }) => (
    <PlayListItem
      item={item}
      active={!!playMusicInfo.musicInfo && playMusicInfo.musicInfo.id == item.id}
      onPress={() => { handlePress(item) }}
      onArmDrag={() => { dragStateRef.current.pressIndex = index }}
      onReleaseDrag={() => {
        if (!dragStateRef.current.active) dragStateRef.current.pressIndex = -1
      }}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [playMusicInfo.musicInfo, handlePress])

  const handleLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutRef.current.height = nativeEvent.layout.height
  }, [])

  const handleScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = nativeEvent.contentOffset.y
  }, [])

  return (
    visible
      ? <Popup ref={popupRef} position="bottom" title={t('player_play_list')} bgHide>
          <View style={sheetHandleStyles.handle}>
            <View style={{ ...sheetHandleStyles.handleBar, backgroundColor: theme['c-font-label'] }} />
          </View>
          {
            list.length
              ? (
                  <View style={styles.listContainer} onLayout={handleLayout} {...panResponder.panHandlers}>
                    <FlatList
                      ref={listRef}
                      style={styles.list}
                      data={list}
                      keyExtractor={item => item.id}
                      renderItem={renderItem}
                      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                      scrollEnabled={!drag}
                      scrollEventThrottle={16}
                      onScroll={handleScroll}
                    />
                    {
                      drag
                        ? (
                            <Animated.View
                              style={{ ...styles.dragItem, transform: [{ translateY: dragAnimY }], backgroundColor: theme['c-content-background'] }}
                              pointerEvents="none"
                            >
                              <Image url={drag.picUrl} style={styles.itemPic} />
                              <View style={styles.itemTexts}>
                                <Text numberOfLines={1} size={15} color={theme['c-font']}>{drag.name}</Text>
                                {
                                  drag.singer
                                    ? <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{drag.singer}</Text>
                                    : null
                                }
                              </View>
                            </Animated.View>
                          )
                        : null
                    }
                  </View>
                )
              : (
                  <View style={styles.empty}>
                    <Text size={13} color={theme['c-font-label']}>
                      {isPlaying ? t('player_play_list_unavailable') : t('player_play_list_empty')}
                    </Text>
                  </View>
                )
          }
        </Popup>
      : null
  )
})

const styles = createStyle({
  listContainer: {
    flexGrow: 0,
    flexShrink: 1,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemPic: {
    width: PIC_SIZE,
    height: PIC_SIZE,
    borderRadius: scaleSizeW(6),
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  itemTexts: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  itemGrip: {
    width: 40,
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragItem: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    gap: 10,
    elevation: 8,
    borderRadius: scaleSizeW(8),
    opacity: 0.95,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 28,
    alignItems: 'center',
  },
})
