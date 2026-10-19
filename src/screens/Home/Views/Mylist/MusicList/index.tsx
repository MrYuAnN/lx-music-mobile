import { useCallback, useMemo, useRef, useState, useEffect } from 'react'

import listState from '@/store/list/state'
import { getListCoverPic } from '../listCoverSource'
import ListMenu, { type ListMenuType, type Position, type SelectInfo } from './ListMenu'
import { clearMusicUrl, guardWritableList, handleCloneList, handleDislikeMusic, handlePlay as handlePlayMusic, handlePlayLater, handleRemove as handleRemoveMusic, handleShare, handleShowMusicSourceDetail, handleUpdateMusicInfo, handleUpdateMusicPosition } from './listAction'
import ListManageMenu, { type ListManageMenuType } from './ListManageMenu'
import AddMusicSheet, { type AddMusicSheetType } from './AddMusicSheet'
import ListNameEdit, { type ListNameEditType } from '../manage/ListNameEdit'
import ListMusicSort, { type ListMusicSortType } from '../manage/ListMusicSort'
import DuplicateMusic, { type DuplicateMusicType } from '../manage/DuplicateMusic'
import ListImportExport, { type ListImportExportType } from '../manage/ListImportExport'
import { handleRemove as handleRemoveList, handleSync } from '../manage/listAction'
import { handleUncollect } from '@/screens/SonglistDetail/listAction'
import List, { type ListType } from './List'
import ListMusicAdd, { type MusicAddModalType as ListMusicAddType } from '@/components/MusicAddModal'
import ListMusicMultiAdd, { type MusicMultiAddModalType as ListAddMultiType } from '@/components/MusicMultiAddModal'
import { createStyle, toast } from '@/utils/tools'
import { Animated, type LayoutChangeEvent, View } from 'react-native'
import MultipleModeBar, { type SelectMode, type MultipleModeBarType } from './MultipleModeBar'
import ListSearchBar, { type ListSearchBarType } from './ListSearchBar'
import ListMusicSearch, { type ListMusicSearchType } from './ListMusicSearch'
import MusicPositionModal, { type MusicPositionModalType } from './MusicPositionModal'
import MetadataEditModal, { type MetadataEditType, type MetadataEditProps } from '@/components/MetadataEditModal'
import MusicToggleModal, { type MusicToggleModalType } from './MusicToggleModal'
import { addDownloadTask } from '@/core/download'
import { playList, togglePlay } from '@/core/player/player'
import { updateSetting } from '@/core/common'
import { useActiveListId, useListFetching, useMyList } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import PlaylistHeader from '@/components/common/PlaylistHeader'
import PlaylistTopBar from '@/components/common/PlaylistTopBar'
import { LIST_IDS } from '@/config/constant'
import { allMusicList, getListMusicSync, getListMusics } from '@/utils/listManage'


export default ({ showBack, onBack, scrollY }: { showBack?: boolean, onBack?: () => void, scrollY: Animated.Value }) => {
  const listMusicSearchRef = useRef<ListMusicSearchType>(null)
  const listRef = useRef<ListType>(null)
  const multipleModeBarRef = useRef<MultipleModeBarType>(null)
  const listSearchBarRef = useRef<ListSearchBarType>(null)
  const listMusicAddRef = useRef<ListMusicAddType>(null)
  const listMusicMultiAddRef = useRef<ListAddMultiType>(null)
  const musicPositionModalRef = useRef<MusicPositionModalType>(null)
  const metadataEditTypeRef = useRef<MetadataEditType>(null)
  const listMenuRef = useRef<ListMenuType>(null)
  const musicToggleModalRef = useRef<MusicToggleModalType>(null)
  const manageMenuRef = useRef<ListManageMenuType>(null)
  const addMusicSheetRef = useRef<AddMusicSheetType>(null)
  const listNameEditRef = useRef<ListNameEditType>(null)
  const listMusicSortRef = useRef<ListMusicSortType>(null)
  const duplicateMusicRef = useRef<DuplicateMusicType>(null)
  const listImportExportRef = useRef<ListImportExportType>(null)
  const layoutHeightRef = useRef<number>(0)
  const isShowMultipleModeBar = useRef(false)
  const isShowSearchBarModeBar = useRef(false)
  const selectedInfoRef = useRef<SelectInfo | undefined>(undefined)
  // 顶栏滚动进度（QQ 式渐显 D2）：页面级（MylistView）创建经 prop 传入，氛围图块滚走/顶栏/列表共用
  // 入场锁定（氛围滚动批 2026-10-19）：程序化落位（恢复/切列表/跳播放位）重置锁定，顶栏从隐藏态
  // 起步且图标回退主题字色；首滚解锁（|offset-落位值|>1dp 判定在 List 内），解锁后交滚动插值接管
  const [entranceLocked, setEntranceLocked] = useState(true)

  const activeListId = useActiveListId()
  const lists = useMyList()
  const fetching = useListFetching(activeListId)
  // 「我喜欢」自定义封面（歌单封面机制批②）：LOVE 详情页头部与氛围底共用此响应式取值；
  // 「默认歌单」同款 defaultPic（2026-10-18 拍板纳入封面机制，setting 双键通道）
  const lovePic = useSettingValue('list.lovePic')
  const defaultPic = useSettingValue('list.defaultPic')
  const isPlay = useIsPlay()
  const playMusicInfo = usePlayMusicInfo()
  // 曲数/列表元数据随事件刷新（HomeSections MyMusic 同款机制）
  const [, setListVersion] = useState(0)
  const bump = useCallback(() => { setListVersion(v => v + 1) }, [])
  useEffect(() => {
    global.state_event.on('mylistUpdated', bump)
    global.app_event.on('myListMusicUpdate', bump)
    return () => {
      global.state_event.off('mylistUpdated', bump)
      global.app_event.off('myListMusicUpdate', bump)
    }
  }, [bump])

  // allMusicList 惰性加载且列表加载完成不发事件——切列表时主动拉一次触发 bump，
  // 否则头部曲数误显 0、播放/随机钮静默失效（审查 I2，首页 LOVE 预载同款模式）
  useEffect(() => {
    void getListMusics(activeListId).then(bump).catch(() => {})
  }, [activeListId, bump])

  const activeListInfo = useMemo(() => {
    return lists.find(l => l.id === activeListId)
  }, [lists, activeListId])

  const isTempList = activeListId == LIST_IDS.TEMP
  const isCollectList = !isTempList && !!(activeListInfo as LX.List.UserListInfo | undefined)?.source

  const currentListName = useMemo(() => {
    switch (activeListId) {
      case LIST_IDS.TEMP:
        return global.i18n.t('list_name_temp')
      case LIST_IDS.DEFAULT:
        return global.i18n.t('list_name_default')
      case LIST_IDS.LOVE:
        return global.i18n.t('list_name_love')
      default:
        return activeListInfo?.name ?? ''
    }
  }, [activeListId, activeListInfo])

  const musicCount = allMusicList.get(activeListId)?.length ?? 0
  // 拍板 #9：收藏=「{来源名} · 收藏于 x」（collectTime 存量缺失降级只显来源）；自建/内置=「n 首歌」
  const subtitle = useMemo(() => {
    const info = activeListInfo as LX.List.UserListInfo | undefined
    if (isCollectList && info?.source) {
      const sourceName = global.i18n.t(`source_real_${info.source}` as never)
      return info.collectTime
        ? global.i18n.t('list_collected_sub', {
            source: sourceName,
            date: `${new Date(info.collectTime).getFullYear()}-${String(new Date(info.collectTime).getMonth() + 1).padStart(2, '0')}-${String(new Date(info.collectTime).getDate()).padStart(2, '0')}`,
          })
        : sourceName
    }
    return global.i18n.t('music_count', { count: musicCount })
  }, [isCollectList, activeListInfo, musicCount])

  const hancelMultiSelect = useCallback(() => {
    if (isShowSearchBarModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(false)
    }
    isShowMultipleModeBar.current = true
    multipleModeBarRef.current?.show()
    listRef.current?.setIsMultiSelectMode(true)
  }, [])
  const hancelExitSelect = useCallback(() => {
    if (isShowSearchBarModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(true)
    }
    // console.log('hancelExitSelect', isShowSearchBarModeBar.current)
    multipleModeBarRef.current?.exitSelectMode()
    listRef.current?.setIsMultiSelectMode(false)
    isShowMultipleModeBar.current = false
  }, [])
  const hancelSwitchSelectMode = useCallback((mode: SelectMode) => {
    multipleModeBarRef.current?.setSwitchMode(mode)
    listRef.current?.setSelectMode(mode)
  }, [])
  const hancelScrollToTop = useCallback(() => {
    listRef.current?.scrollToTop()
  }, [])

  const showMenu = useCallback((musicInfo: LX.Music.MusicInfo, index: number, position: Position) => {
    listMenuRef.current?.show({
      musicInfo,
      index,
      listId: listState.activeListId,
      single: false,
      selectedList: listRef.current!.getSelectedList(),
    }, position)
  }, [])
  const handleShowSearch = useCallback(() => {
    isShowSearchBarModeBar.current = true
    if (isShowMultipleModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(false)
    }
    listSearchBarRef.current?.show()
  }, [])
  const handleExitSearch = useCallback(() => {
    isShowSearchBarModeBar.current = false
    listMusicSearchRef.current?.hide()
    listSearchBarRef.current?.hide()
    // console.log('handleExitSearch', isShowSearchBarModeBar.current)
    if (isShowMultipleModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(true)
    }
  }, [])
  const handleScrollToInfo = useCallback((info: LX.Music.MusicInfo) => {
    listRef.current?.scrollToInfo(info)
    handleExitSearch()
  }, [handleExitSearch])
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }, [])

  const handleAddMusic = useCallback((info: SelectInfo) => {
    if (info.selectedList.length) {
      listMusicMultiAddRef.current?.show({ selectedList: info.selectedList, listId: info.listId, isMove: false })
    } else {
      listMusicAddRef.current?.show({ musicInfo: info.musicInfo, listId: info.listId, isMove: false })
    }
  }, [])
  const handleMoveMusic = useCallback((info: SelectInfo) => {
    // 收藏歌单只读守卫（审查 A5）：移动=从当前歌单移除，handler 层封堵
    if (!guardWritableList(info.listId)) return
    if (info.selectedList.length) {
      listMusicMultiAddRef.current?.show({ selectedList: info.selectedList, listId: info.listId, isMove: true })
    } else {
      listMusicAddRef.current?.show({ musicInfo: info.musicInfo, listId: info.listId, isMove: true })
    }
  }, [])
  const handleEditMetadata = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source != 'local') return
    selectedInfoRef.current = info
    metadataEditTypeRef.current?.show(info.musicInfo.meta.filePath)
  }, [])
  const handleUpdateMetadata = useCallback<MetadataEditProps['onUpdate']>((info) => {
    if (!selectedInfoRef.current || selectedInfoRef.current.musicInfo.source != 'local') return
    handleUpdateMusicInfo(selectedInfoRef.current.listId, selectedInfoRef.current.musicInfo, info)
  }, [])

  const handlePlayAll = useCallback(() => {
    if (!musicCount) return
    void playList(activeListId, 0)
  }, [activeListId, musicCount])
  // 真乱序随机播放（D3 拍板）：切全局 random 模式（播放页循环图标同步可见）+ 从第一首开始；
  // 空列表守卫必须前置（审查 I-2）——防空歌单清空当前播放信息 + 白切全局模式
  const handlePlayShuffle = useCallback(() => {
    const list = getListMusicSync(activeListId)
    if (!list?.length) return
    void updateSetting({ 'player.togglePlayMethod': 'random' })
    void playList(activeListId, 0)
  }, [activeListId])

  const header = useMemo(() => (
    <PlaylistHeader
      title={currentListName}
      subtitle={subtitle}
      // 封面走 getListCoverPic 单源三态（LOVE/DEFAULT setting 单键，封面机制批）；null 归一 undefined
      pic={getListCoverPic(activeListId, lovePic, defaultPic, activeListInfo as LX.List.UserListInfo | undefined) ?? undefined}
      // 收藏闭环（2026-10-18 拍板）：仅收藏克隆歌单显示实心红心，取消=确认后删本地克隆；
      // 自建/内置无红心（业界定式，管理走 ⋮）
      showCollectHeart={isCollectList}
      collected={isCollectList}
      onCollectToggle={isCollectList && activeListInfo ? () => {
        void handleUncollect(activeListInfo as LX.List.UserListInfo).then(removed => {
          // 取消收藏的是当前查看的列表：返回上一屏（真机反馈轮 5，不落默认歌单页）
          if (removed && (activeListInfo as LX.List.UserListInfo).id == activeListId) onBack?.()
        })
      } : undefined}
      fetching={fetching}
      playing={isPlay && playMusicInfo.listId == activeListId}
      onTogglePlay={togglePlay}
      onPlay={handlePlayAll}
      onShufflePlay={handlePlayShuffle}
      onScrollToTop={hancelScrollToTop}
    />
  ), [currentListName, subtitle, activeListInfo, fetching, isPlay, playMusicInfo.listId, activeListId, isCollectList, lovePic, defaultPic, handlePlayAll, handlePlayShuffle, hancelScrollToTop, onBack])


  return (
    <View style={styles.container}>
      <View style={{ zIndex: 2 }}>
        <MultipleModeBar
          ref={multipleModeBarRef}
          onSwitchMode={hancelSwitchSelectMode}
          onSelectAll={isAll => listRef.current?.selectAll(isAll)}
          onExitSelectMode={hancelExitSelect}
        />
        <ListSearchBar
          ref={listSearchBarRef}
          onSearch={keyword => listMusicSearchRef.current?.search(keyword, layoutHeightRef.current)}
          onExitSearch={handleExitSearch}
        />
      </View>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <List
          ref={listRef}
          header={header}
          scrollYAnimated={scrollY}
          onProgrammaticScroll={() => { setEntranceLocked(true) }}
          onFirstRealScroll={() => { setEntranceLocked(false) }}
          onShowMenu={showMenu}
          onMuiltSelectMode={hancelMultiSelect}
          onSelectAll={isAll => multipleModeBarRef.current?.setIsSelectAll(isAll)}
        />
        <ListMusicSearch
          ref={listMusicSearchRef}
          onScrollToInfo={handleScrollToInfo}
        />
      </View>
      <PlaylistTopBar
        title={currentListName}
        progress={scrollY}
        // 封面三态与 MylistView ambientPic 同源（代码审查 S-B/S-1）：LOVE/DEFAULT 自定义封面也回白图标
        onArtwork={!!getListCoverPic(activeListId, lovePic, defaultPic, activeListInfo as LX.List.UserListInfo | undefined)}
        entranceLocked={entranceLocked}
        showBack={showBack}
        onBack={onBack}
        showSearch
        onSearch={handleShowSearch}
        showManage={!isTempList}
        onManageMenu={() => { if (activeListInfo) manageMenuRef.current?.show(activeListInfo) }}
      />
      <ListMusicAdd ref={listMusicAddRef} onAdded={hancelExitSelect} />
      <ListMusicMultiAdd ref={listMusicMultiAddRef} onAdded={hancelExitSelect} />
      <MusicPositionModal ref={musicPositionModalRef}
        onUpdatePosition={(info, postion) => { if (!guardWritableList(info.listId)) return; handleUpdateMusicPosition(postion, info.listId, info.musicInfo, info.selectedList, hancelExitSelect) }} />
      <ListMenu
        ref={listMenuRef}
        onPlay={info => { handlePlayMusic(info.listId, info.index) }}
        onPlayLater={info => { hancelExitSelect(); handlePlayLater(info.listId, info.musicInfo, info.selectedList, hancelExitSelect) }}
        onRemove={info => { if (!guardWritableList(info.listId)) return; hancelExitSelect(); handleRemoveMusic(info.listId, info.musicInfo, info.selectedList, hancelExitSelect) }}
        onDislikeMusic={info => { void handleDislikeMusic(info.musicInfo) }}
        onCopyName={info => { handleShare(info.musicInfo) }}
        onMusicSourceDetail={info => { void handleShowMusicSourceDetail(info.musicInfo) }}
        onAdd={handleAddMusic}
        onMove={handleMoveMusic}
        onEditMetadata={handleEditMetadata}
        onChangePosition={info => { if (!guardWritableList(info.listId)) return; musicPositionModalRef.current?.show(info) }}
        onToggleSource={info => { if (!guardWritableList(info.listId)) return; musicToggleModalRef.current?.show(info) }}
        onRemoveCache={info => { void clearMusicUrl(info.musicInfo) }}
        onDownload={info => {
          if (info.musicInfo.source == 'local') return
          void addDownloadTask(info.musicInfo).then(added => {
            toast(global.i18n.t(added ? 'download_added' : 'download_exists'))
          })
        }}
      />
      <ListManageMenu
        ref={manageMenuRef}
        onAddMusic={info => { addMusicSheetRef.current?.show(info.id) }}
        onCloneLocal={info => { handleCloneList(info).catch(() => { toast(global.i18n.t('list_clone_fail')) }) }}
        onRename={info => listNameEditRef.current?.show(info)}
        onEditLoveCover={() => listNameEditRef.current?.showLove()}
        onEditDefaultCover={() => listNameEditRef.current?.showDefault()}
        onSort={info => listMusicSortRef.current?.show(info)}
        onDuplicateMusic={info => duplicateMusicRef.current?.show(info)}
        onImportFile={(info, index) => listImportExportRef.current?.import(info, index)}
        onImportLocalFile={(info, index) => listImportExportRef.current?.selectFile(info, index)}
        onExport={(info, index) => listImportExportRef.current?.export(info, index)}
        onSync={info => handleSync(info)}
        // 收藏克隆 ⋮ 取消收藏与红心同款确认+toast（二轮审查 I-2 分流）；自建走删除；删当前列表 pop 回来路
        onRemove={info => {
          const action = info.source ? handleUncollect(info) : handleRemoveList(info)
          void action.then(removed => { if (removed && info.id == activeListId) onBack?.() })
        }}
      />
      <ListNameEdit ref={listNameEditRef} />
      <ListMusicSort ref={listMusicSortRef} />
      <DuplicateMusic ref={duplicateMusicRef} />
      <ListImportExport ref={listImportExportRef} />
      <AddMusicSheet ref={addMusicSheetRef} />
      <MetadataEditModal
        ref={metadataEditTypeRef}
        onUpdate={handleUpdateMetadata}
      />
      <MusicToggleModal ref={musicToggleModalRef} />
    </View>
  )
}


const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
})
