import { useRef, useImperativeHandle, forwardRef, useState, useCallback, memo, useEffect } from 'react'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { FlatList, TouchableOpacity, View, type FlatListProps as _FlatListProps } from 'react-native'
import { scaleSizeH } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { type DuplicateMusicItem, filterDuplicateMusic } from './utils'
import { getListMusics, removeListMusics } from '@/core/list'
import { Icon } from '@/components/common/Icon'
import { useUnmounted } from '@/utils/hooks'
import { playList } from '@/core/player/player'
import { useI18n } from '@/lang'
import { handleRemove } from '../MusicList/listAction'
import { useDownloadedSet, action as downloadedAction } from '@/store/downloaded'
import { toOnlineIdentity } from '@/utils/music'
import Button from '@/components/common/Button'
import { SPACING } from '@/config/spacing'

type FlatListProps = _FlatListProps<DuplicateMusicItem>
const ITEM_HEIGHT = scaleSizeH(56)

const Title = ({ title }: {
  title: string
}) => {
  return (
    <Text style={styles.title} size={16}>
      {title}
    </Text>
  )
}

const Empty = () => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={styles.noitem}>
      <Text color={theme['c-font-label']}>{t('no_item')}</Text>
    </View>
  )
}

const ListItem = memo(({ info, index, downloaded = false, onRemove, onPlay, selectedList, onPress }: {
  info: DuplicateMusicItem
  index: number
  /** 已下载标记（2026-10-29 标记重做 D4）：副行右端锚定，与主列表行同构 */
  downloaded?: boolean
  selectedList: DuplicateMusicItem[]
  onPlay: (info: DuplicateMusicItem) => void
  onRemove: (idx: number) => void
  onPress: (info: DuplicateMusicItem) => void
}) => {
  const theme = useTheme()
  const isSelected = selectedList.includes(info)

  return (
    <View style={{ ...styles.listItem, height: ITEM_HEIGHT, backgroundColor: isSelected ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)' }} onStartShouldSetResponder={() => true}>
      {/* <View style={styles.listItemLabel}>
        <Text style={styles.sn} size={13} color={theme['c-300']}>{info.index + 1}</Text>
      </View> */}
      <TouchableOpacity style={styles.listItemInfo} onPress={() => { onPress(info) }}>
        <Text color={theme['c-font']} size={14} numberOfLines={1}>{info.musicInfo.name}</Text>
        <View style={styles.listItemAlbum}>
          <Text style={styles.listItemSublineText} color={theme['c-font']} size={12} numberOfLines={1}>
            {info.musicInfo.singer}
            {
              info.musicInfo.meta.albumName ? (
                <Text color={theme['c-font-label']} size={12} numberOfLines={1}> ({info.musicInfo.meta.albumName})</Text>
              ) : null
            }
          </Text>
          {
            downloaded
              ? (
                  // wrapper View 承载右锚+间距（审查 I-3）：Svg 的 padding Android 端不可靠
                  <View style={styles.downloadedBadge}>
                    <Icon name="check-circle" size={ICON_SIZE.inline} color={theme['c-primary']} />
                  </View>
                )
              : null
          }
        </View>
      </TouchableOpacity>
      <View style={styles.listItemLabel}>
        <Text style={styles.listItemLabelText} size={13} color={theme['c-300']}>{ info.musicInfo.source }</Text>
        <Text style={styles.listItemLabelText} size={13} color={theme['c-300']}>{info.musicInfo.interval}</Text>
      </View>
      <View style={styles.listItemBtns}>
        <Button style={styles.listItemBtn} onPress={() => { onPlay(info) }}>
          <Icon name="play-outline" style={{ color: theme['c-button-font'] }} size={ICON_SIZE.inline} />
        </Button>
        <Button style={styles.listItemBtn} onPress={() => { onRemove(index) }}>
          <Icon name="remove" style={{ color: theme['c-button-font'] }} size={ICON_SIZE.inline} />
        </Button>
      </View>
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.info === nextProps.info &&
  prevProps.index === nextProps.index &&
  prevProps.downloaded === nextProps.downloaded &&
  nextProps.selectedList.includes(nextProps.info) == prevProps.selectedList.includes(nextProps.info)
})

const handleRemoveList = (list: DuplicateMusicItem[], index: number) => {
  let prev = list[index - 1]
  let cur = list[index]
  let next = list[index + 1]
  let count = 1
  if (prev?.group != cur.group) {
    if (next?.group == cur.group && list[index + 2]?.group != cur.group) {
      count = 2
    }
  } else if (next?.group != cur.group) {
    if (prev?.group == cur.group && list[index - 2]?.group != cur.group) {
      index -= 1
      count = 2
    }
  }

  return list.splice(index, count)
}
const List = ({ listId }: { listId: string }) => {
  const [list, setList] = useState<DuplicateMusicItem[]>([])
  const [selectedList, setSelectedList] = useState<DuplicateMusicItem[]>([])
  const dataRef = useRef<[DuplicateMusicItem[], DuplicateMusicItem[]]>([[], []])
  const isUnmountedRef = useUnmounted()
  // 已下载标记数据源（容器层单点订阅，审查 I-5）
  const downloadedSet = useDownloadedSet()

  const handleFilterList = useCallback(() => {
    if (isUnmountedRef.current) return
    void getListMusics(listId).then((list) => {
      if (isUnmountedRef.current) return
      void filterDuplicateMusic(list).then((l) => {
        if (isUnmountedRef.current) return
        setSelectedList(dataRef.current[1] = [])
        setList(dataRef.current[0] = l)
      })
    })
  }, [isUnmountedRef, listId])
  const handlePlay = useCallback((info: DuplicateMusicItem) => {
    const { musicInfo } = info
    void getListMusics(listId).then((list) => {
      const idx = list.findIndex(m => m.id == musicInfo.id)
      if (idx < 0) return
      void playList(listId, idx)
    })
  }, [listId])
  const handleRemovePress = useCallback((index: number) => {
    const selectedList = dataRef.current[1]
    const list = dataRef.current[0]
    if (selectedList.length) {
      handleRemove(listId, list[index].musicInfo, selectedList.map(m => m.musicInfo), () => {
        let newList = [...list]
        for (const item of selectedList) {
          let idx = newList.indexOf(item)
          if (idx < 0) continue
          handleRemoveList(newList, idx)
        }
        setList(dataRef.current[0] = newList)
        setSelectedList(dataRef.current[1] = [])
      })
      return
    }
    let newList = [...list]
    let curItem = list[index]
    const rmItem = handleRemoveList(newList, index)
    let newSelectList = [...selectedList]
    for (const item of rmItem) {
      let idx = newSelectList.indexOf(item)
      if (idx < 0) continue
      newSelectList.splice(idx, 1)
    }
    setSelectedList(dataRef.current[1] = newSelectList)

    requestAnimationFrame(() => {
      void removeListMusics(listId, [curItem.musicInfo.id])
    })
    setList(dataRef.current[0] = newList)
  }, [listId])
  const handleSelect = useCallback((info: DuplicateMusicItem) => {
    setSelectedList(selectedList => {
      let nList = [...selectedList]
      let idx = nList.indexOf(info)
      if (idx < 0) nList.push(info)
      else nList.splice(idx, 1)
      dataRef.current[1] = nList
      return nList
    })
  }, [])

  useEffect(handleFilterList, [handleFilterList])

  const renderItem = useCallback(({ item, index }: { item: DuplicateMusicItem, index: number }) => {
    // 下载曲 local 形态按原曲在线身份判勾（题3 归一口径，代码审查 I-2-a）
    const identity = toOnlineIdentity(item.musicInfo)
    return <ListItem
      info={item}
      index={index}
      downloaded={downloadedSet.has(downloadedAction.getDownloadedKey(identity.source, identity.id))}
      onPlay={handlePlay}
      onRemove={handleRemovePress}
      selectedList={selectedList}
      onPress={handleSelect}
    />
  }, [handlePlay, handleRemovePress, handleSelect, selectedList, downloadedSet])
  const getkey = useCallback<NonNullable<FlatListProps['keyExtractor']>>(item => item.id, [])
  const getItemLayout = useCallback<NonNullable<FlatListProps['getItemLayout']>>((data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }, [])

  return (
    list.length ? (
      <FlatList
        style={styles.list}
        maxToRenderPerBatch={4}
        windowSize={8}
        removeClippedSubviews={true}
        initialNumToRender={12}
        data={list}
        renderItem={renderItem}
        keyExtractor={getkey}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
      />
    ) : (
      <Empty />
    )
  )
}

export interface ModalType {
  show: (info: SY.List.MyListInfo) => void
}
const initInfo = {}

const Modal = forwardRef<ModalType, {}>((props, ref) => {
  const [info, setInfo] = useState<SY.List.MyListInfo>(initInfo as SY.List.MyListInfo)
  const dialogRef = useRef<DialogType>(null)
  useImperativeHandle(ref, () => ({
    show(info) {
      setInfo(info)

      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }))
  const handleHide = () => {
    requestAnimationFrame(() => {
      const ninfo = { ...info, name: '' }
      setInfo(ninfo)
    })
  }

  return (
    <Dialog ref={dialogRef} onHide={handleHide} closeBtn>
      {
        info.name
          ? (<>
              <Title title={info.name} />
              <List listId={info.id} />
            </>)
          : null
      }
    </Dialog>
  )
})

export interface DuplicateMusicType {
  show: (info: SY.List.MyListInfo) => void
}

export default forwardRef<DuplicateMusicType, {}>((props, ref) => {
  const musicAddModalRef = useRef<ModalType>(null)
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      if (visible) musicAddModalRef.current?.show(listInfo)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          musicAddModalRef.current?.show(listInfo)
        })
      }
    },
  }))

  return (
    visible
      ? <Modal ref={musicAddModalRef} />
      : null
  )
})


const styles = createStyle({
  container: {
    // flexGrow: 1,
  },
  title: {
    textAlign: 'center',
    paddingVertical: SPACING.s16,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  list: {
    flexGrow: 0,
  },
  listItem: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  // sn: {
  //   width: 38,
  //   // fontSize: 12,
  //   textAlign: 'center',
  //   // backgroundColor: 'rgba(0,0,0,0.2)',
  //   paddingLeft: 3,
  //   paddingRight: 3,
  // },
  listItemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    // backgroundColor: 'rgba(0,0,0,0.2)',
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s6,
  },
  listItemAlbum: {
    flexDirection: 'row',
    marginTop: SPACING.s4,
  },
  // 歌手文本可收缩：防长歌手挤出右锚标记（主列表 sublineText 同构）
  listItemSublineText: {
    flexShrink: 1,
  },
  // 已下载标记副行右端锚定（标记重做 D2 同构）：wrapper View 承载（审查 I-3）
  downloadedBadge: {
    marginLeft: 'auto',
    paddingLeft: SPACING.s4,
  },
  listItemLabel: {
    flex: 0,
  },
  listItemLabelText: {
    paddingHorizontal: SPACING.s6,
  },
  listItemBtns: {
    flex: 0,
    flexDirection: 'row',
    gap: SPACING.s6,
    paddingHorizontal: SPACING.s8,
  },
  listItemBtn: {
    padding: SPACING.s8,
  },
  noitem: {
    paddingVertical: 35,
    alignItems: 'center',
  },
})


