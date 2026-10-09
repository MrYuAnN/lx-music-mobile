import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'

import { useTheme } from '@/store/theme/hook'
import { useMyList } from '@/store/list/hook'
import { createStyle } from '@/utils/tools'
import { setActiveList } from '@/core/list'
import { getMusicCountSync, initMusicCounts } from '@/utils/listManage'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { type Position } from './ListMenu'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

const TILE_SIZE = scaleSizeW(44)
const ITEM_HEIGHT = scaleSizeH(64)

const listOrder = (id: string) => {
  if (id == LIST_IDS.LOVE) return 0
  if (id == LIST_IDS.DEFAULT) return 2
  return 1
}

const ListItem = memo(({ item, index, count, onPress, onShowMenu }: {
  onPress: (item: LX.List.MyListInfo) => void
  index: number
  count: number | null
  item: LX.List.MyListInfo
  onShowMenu: (item: LX.List.MyListInfo, index: number, position: { x: number, y: number, w: number, h: number }) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const moreButtonRef = useRef<TouchableOpacity>(null)

  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }

  return (
    <View style={{ ...styles.listItem, height: ITEM_HEIGHT }}>
      <TouchableOpacity style={styles.listMain} onPress={() => { onPress(item) }}>
        <View style={{ ...styles.tile, backgroundColor: theme['c-primary-light-400-alpha-900'] }}>
          <Icon name={item.id == LIST_IDS.LOVE ? 'love' : 'album'} size={18} color={theme['c-primary']} />
        </View>
        <View style={styles.listInfo}>
          <Text numberOfLines={1} size={16} color={theme['c-font']}>{item.name}</Text>
          <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{count == null ? '--' : t('songs_count', { num: count })}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.listMoreBtn}>
        <Icon name="dots-vertical" color={theme['c-font-label']} size={16} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.item.name == nextProps.item.name &&
    prevProps.count == nextProps.count)
})


export default ({ onShowMenu, filterCollected = false }: {
  onShowMenu: (info: { listInfo: LX.List.MyListInfo, index: number }, position: Position) => void
  /** 首页「我的」Tab 传入：排除收藏的在线歌单（与收藏 Tab 互斥）；MYLIST 独立屏不传保持全量 */
  filterCollected?: boolean
}) => {
  const allList = useMyList()
  const [counts, setCounts] = useState<Record<string, number>>({})

  // 列表顺序（批次⑤）：我的收藏置顶、用户歌单居中、试听列表收尾；首页场景排除收藏条目
  const orderedList = useMemo(() => {
    const base = filterCollected
      ? allList.filter(l => !('sourceListId' in l && l.sourceListId))
      : allList
    return [...base].sort((a, b) => listOrder(a.id) - listOrder(b.id))
  }, [allList, filterCollected])

  useEffect(() => {
    let isInited = false
    // 曲目数走持久化计数（musicCounts），不为计数加载曲目列表；未浏览过的歌单显示 '--'
    void initMusicCounts().then(() => {
      if (isInited) return
      isInited = true
      setCounts(prev => {
        const next = { ...prev }
        for (const l of allList) {
          const count = getMusicCountSync(l.id)
          if (count != null) next[l.id] = count
        }
        return next
      })
    })

    const handleMusicUpdate = (ids: string[]) => {
      setCounts(prev => {
        const next = { ...prev }
        let changed = false
        for (const id of ids) {
          const count = getMusicCountSync(id)
          if (count == null || next[id] === count) continue
          next[id] = count
          changed = true
        }
        return changed ? next : prev
      })
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)

    return () => {
      isInited = true
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [allList])

  const handlePressList = (item: LX.List.MyListInfo) => {
    const componentId = commonState.componentIds.home
    if (!componentId) return
    // 防止长按跳转残留的标志把本详情屏错误接管到播放列表（正常时它已被消费，此处仅兜底）
    global.lx.jumpMyListPosition = false
    setActiveList(item.id)
    navigations.pushMylistDetailScreen(componentId, item)
  }

  const showMenu = (listInfo: LX.List.MyListInfo, index: number, position: Position) => {
    onShowMenu({ listInfo, index }, position)
  }

  return (
    <View style={styles.container}>
      {orderedList.map((item, index) => (
        <ListItem
          key={item.id}
          item={item}
          index={index}
          count={counts[item.id] ?? null}
          onPress={handlePressList}
          onShowMenu={showMenu}
        />
      ))}
    </View>
  )
}


const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  listMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
    flexShrink: 1,
    paddingLeft: 12,
    justifyContent: 'center',
    gap: 2,
  },
  listMoreBtn: {
    height: '100%',
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
