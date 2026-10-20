import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useCallback } from 'react'
import { Animated, View } from 'react-native'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { clearListDetail, getListDetail, setListDetail, setListDetailInfo } from '@/core/songlist'
import songlistState from '@/store/songlist/state'
import { handlePlay } from './listAction'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import ListMusicSearch, { type ListMusicSearchType } from '@/screens/Home/Views/Mylist/MusicList/ListMusicSearch'
import Header, { type HeaderType } from './Header'
import { useListInfo } from './state'

export interface MusicListProps {
  componentId: string
  /** 顶栏滚动进度（QQ 式渐显 D2）：透传 OnlineList，页面级创建（审查 S-1 同层） */
  scrollYAnimated?: Animated.Value
  /** 列表内搜索定位完成回调（顶栏融合式，方案 §B3）：宿主据此命令顶栏退出搜索态 */
  onLocated?: () => void
  /** 拉取信息上抛（歌单链接导入批 R2）：loadList 各回填时点把 store 侧拉取名/图上抛宿主，
   * 供顶栏标题/氛围底回填（props 空的导入入口拉取后渐显真实名图；props 优先合并由宿主做） */
  onInfoLoaded?: (name?: string, img?: string) => void
}

export interface MusicListType {
  loadList: (source: LX.OnlineSource, listId: string) => void
  /** 列表内搜索输入（顶栏融合式接线）：高度由本组件容器 onLayout 实测（复审 S-N1） */
  search: (keyword: string) => void
  /** 退出搜索（顶栏退出回调链）：隐藏定位浮层 */
  exitSearch: () => void
}

export default forwardRef<MusicListType, MusicListProps>(({ componentId, scrollYAnimated, onLocated, onInfoLoaded }, ref) => {
  const listRef = useRef<OnlineListType>(null)
  const headerRef = useRef<HeaderType>(null)
  const listMusicSearchRef = useRef<ListMusicSearchType>(null)
  const listHeightRef = useRef(0)
  const statusbarHeight = useStatusbarHeight()
  const isUnmountedRef = useRef(false)
  const info = useListInfo()
  // 搜索定位浮层高度来源：列表容器实测减顶栏区（浮层宿主容器钉在顶栏下，真机反馈 2026-10-20）
  const handleListLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    listHeightRef.current = e.nativeEvent.layout.height
  }, [])
  const handleScrollToInfo = useCallback((musicInfo: LX.Music.MusicInfo) => {
    listRef.current?.scrollToInfo(musicInfo)
    onLocated?.()
  }, [onLocated])
  const getListMusicSnapshot = useCallback(async() => songlistState.listDetailInfo.list, [])

  useImperativeHandle(ref, () => ({
    search(keyword) {
      listMusicSearchRef.current?.search(keyword, Math.max(0, listHeightRef.current - statusbarHeight - SCREEN_HEADER_HEIGHT))
    },
    exitSearch() {
      listMusicSearchRef.current?.hide()
    },
    async loadList(source, id) {
      clearListDetail()
      const listDetailInfo = songlistState.listDetailInfo
      listRef.current?.setList([])
      // 注：本分支现状恒不可达——上方 clearListDetail() 已清 id/list（action 就地变异），
      // 缓存命中判定永假（代码审查 S3 留档）；激活缓存快路径（clear 移到判定后）另批评估
      if (listDetailInfo.id == id && listDetailInfo.source == source && listDetailInfo.list.length) {
        requestAnimationFrame(() => {
          listRef.current?.setList(listDetailInfo.list, false, true)
          headerRef.current?.setInfo({
            name: (info.name || listDetailInfo.info.name) ?? '',
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            desc: listDetailInfo.info.desc || info.desc || '',
            imgUrl: info.img ?? listDetailInfo.info.img,
          })
          onInfoLoaded?.(listDetailInfo.info.name, listDetailInfo.info.img)
        })
      } else {
        listRef.current?.setStatus('loading')
        const page = 1
        setListDetailInfo(info.source, info.id)
        headerRef.current?.setInfo({
          name: (info.name || listDetailInfo.info.name) ?? '',
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          desc: listDetailInfo.info.desc || info.desc || '',
          imgUrl: info.img ?? listDetailInfo.info.img,
        })
        // 拉取前 info 已被 clearListDetail 清空：上抛空值让宿主顶栏回退 props（导入入口加载期空白为预期）
        onInfoLoaded?.(listDetailInfo.info.name, listDetailInfo.info.img)
        return getListDetail(id, source, page).then((listDetail) => {
          const result = setListDetail(listDetail, id, page)
          if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            headerRef.current?.setInfo({
              name: (info.name || listDetailInfo.info.name) ?? '',
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              desc: listDetailInfo.info.desc || info.desc || '',
                imgUrl: info.img ?? listDetailInfo.info.img,
            })
            onInfoLoaded?.(listDetailInfo.info.name, listDetailInfo.info.img)
            listRef.current?.setList(result.list, false, true)
            listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
          listRef.current?.setStatus('error')
        })
      }
    },
  }))

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handlePlayList: OnlineListProps['onPlayList'] = (index) => {
    const listDetailInfo = songlistState.listDetailInfo
    // console.log(songlistState.listDetailInfo)
    void handlePlay(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list, index)
  }
  // 拉取成功即回填 hero/顶栏/氛围底（代码审查 I2）：error 重试（loadMore page==1）与下拉刷新
  // 路径此前只 setList 不回填，导入入口 props 空名时该链路是头部信息的唯一回填时机
  const syncDetailInfo = () => {
    const listDetailInfo = songlistState.listDetailInfo
    headerRef.current?.setInfo({
      name: (info.name || listDetailInfo.info.name) ?? '',
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      desc: listDetailInfo.info.desc || info.desc || '',
      imgUrl: info.img ?? listDetailInfo.info.img,
    })
    onInfoLoaded?.(listDetailInfo.info.name, listDetailInfo.info.img)
  }
  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    const page = 1
    listRef.current?.setStatus('refreshing')
    getListDetail(songlistState.listDetailInfo.id, songlistState.listDetailInfo.source, page, true).then((listDetail) => {
      const result = setListDetail(listDetail, songlistState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list, false, true)
      listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
      syncDetailInfo()
    }).catch(() => {
      if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    listRef.current?.setStatus('loading')
    const page = songlistState.listDetailInfo.list.length ? songlistState.listDetailInfo.page + 1 : 1
    getListDetail(songlistState.listDetailInfo.id, songlistState.listDetailInfo.source, page).then((listDetail) => {
      const result = setListDetail(listDetail, songlistState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list, true, true)
      listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
      // page==1 即 error 重试成功，store info 已填充，补头部回填；翻页（page>1）info 不变跳过
      if (page == 1) syncDetailInfo()
    }).catch(() => {
      if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
      listRef.current?.setStatus('error')
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const header = useMemo(() => <Header ref={headerRef} componentId={componentId} />, [])

  return (
    <View style={styles.container} onLayout={handleListLayout}>
      <OnlineList
        ref={listRef}
        onPlayList={handlePlayList}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        ListHeaderComponent={header}
        scrollYAnimated={scrollYAnimated}
        // progressViewOffset={}
      />
      {/* 列表内搜索定位浮层（方案 §B3 新增接线）：数据源=在线歌单快照；store 快照链路无全局变更事件，
          subscribeListEvents=false（复审 N-4 勿硬造订阅）。宿主容器钉在顶栏下缘（真机反馈 2026-10-20：
          浮层原从屏顶铺开盖住搜索框） */}
      <View style={{ ...styles.searchTipHost, top: statusbarHeight + SCREEN_HEADER_HEIGHT }}>
        <ListMusicSearch
          ref={listMusicSearchRef}
          getList={getListMusicSnapshot}
          subscribeListEvents={false}
          onScrollToInfo={handleScrollToInfo}
        />
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  searchTipHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
})

