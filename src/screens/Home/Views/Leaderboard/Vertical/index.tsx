import { useEffect, useReducer, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import GlassSurface, { GLASS_BAR_FALLBACK, GLASS_FADE_RANGE } from '@/components/common/GlassSurface'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import HeaderBar, { type HeaderBarType, type HeaderBarProps } from './HeaderBar'
import { getBoardsList } from '@/core/leaderboard'
import { handleCollect, handlePlay } from '../listAction'
import boardState from '@/store/leaderboard/state'
import SourcesOfflineTip from '@/components/common/SourcesOfflineTip'

// 排行榜竖屏页（拍板定稿）：顶栏单胶囊 + 级联 sheet 取代原「音源下拉+榜单名按钮+侧抽屉」；
// DrawerLayoutFixed 与 BoardsList 引用已摘除（BoardsList 组件保留，横屏 LeftBar 仍在用）。
// 并发口径（代码审查 I-A/I-B 收口）：切源的数据获取单链在 sheet（seq 守卫在彼处），
// 本组件 sourceChangeSeqRef 仅用于使冷启动 init 的迟到响应失效；onSourceChange 以完整
// (source, board) 同步应用，boundInfo 不再有 source/id 分步写入的混合窗口。
// 恒接线契约（批二审查架构师 I-1 收紧）：竖屏唯一宿主 screens/Leaderboard 恒传两参
// （未接线流内分支已删，见下方注释）——props 必选，漏传 tsc 阶段拦截
export interface LeaderboardVerticalProps {
  /** 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：竖屏 screen 宿主必传启用穿行 */
  scrollYAnimated: Animated.Value
  contentPaddingTop: number
}

export default ({ scrollYAnimated, contentPaddingTop }: LeaderboardVerticalProps) => {
  const theme = useTheme()
  // 榜单胶囊固定子头实测高（钉 header 下方，玻璃垫层渐显穿行——Search 终轮 C-2 同款）
  const [headerBarHeight, setHeaderBarHeight] = useState(0)
  // 子头玻璃垫层渐显插值（与 ScreenHeader 同区间同 Value，GLASS_FADE_RANGE 单源）
  const subHeaderFade = scrollYAnimated.interpolate({ inputRange: GLASS_FADE_RANGE, outputRange: [0, 1], extrapolate: 'clamp' })
  const musicListRef = useRef<MusicListType>(null)
  const headerBarRef = useRef<HeaderBarType>(null)
  // 首项跟随（批1 阶段2）：初始源=store 构建集首项（替换 'kw' 硬编码）
  const boundInfo = useRef<{ source: LX.OnlineSource, id: string | null }>({ source: boardState.sources[0] ?? 'kw', id: null })
  const sourceChangeSeqRef = useRef(0)

  const handleBoundChange = (source: LX.OnlineSource, id: string) => {
    musicListRef.current?.loadList(source, id)
    void saveLeaderboardSetting({
      source,
      boardId: id,
    })
  }

  // sheet 点选榜单：更新显示 + 加载列表 + 持久化。seq 递增使在途 init 迟到响应全部失效
  // （防 init 网络窗口内选榜被覆盖，三席审查 #7）
  const onBoundSelect: HeaderBarProps['onBoundSelect'] = (source, id, name) => {
    sourceChangeSeqRef.current++
    boundInfo.current = { source, id }
    headerBarRef.current?.setBound(source, id, name)
    handleBoundChange(source, id)
  }

  // sheet 切源（拍板#3：切源即应用该源第一榜；board 由 sheet 单链守卫后上交）
  const onSourceChange: HeaderBarProps['onSourceChange'] = (source, board) => {
    sourceChangeSeqRef.current++ // 使在途 init 响应失效
    boundInfo.current = { source, id: board.id }
    headerBarRef.current?.setBound(source, board.id, board.name ?? 'Unknown')
    handleBoundChange(source, board.id)
  }

  // ⋯播放：仅点选的榜单就是当前主列表时复用其数据，否则交给 handlePlay 按 id 拉取
  // （切源网络窗口内点 ⋯ 不再先短暂播放旧榜内容，审查 S-5）
  const onPlay: HeaderBarProps['onPlay'] = (id) => {
    const info = boardState.listDetailInfo
    void handlePlay(id, info.id == id ? info.list : undefined)
  }
  const onCollect: HeaderBarProps['onCollect'] = (id, name) => {
    void handleCollect(id, name, boundInfo.current.source)
  }

  useEffect(() => {
    const seq = ++sourceChangeSeqRef.current
    void getLeaderboardSetting().then((setting) => {
      let { source, boardId } = setting
      // boundInfo 写入与 loadList 同样纳入 seq 守卫：用户在途选榜/切源不被 init 各阶段覆盖
      // （三席审查 #7 守卫补全，此前只包 setBound）
      // 边界②（批1 阶段2）：持久化源已被摘（不在 /config 开启集）→重置首项
      if (!boardState.sources.includes(source) && boardState.sources.length) {
        source = boardState.sources[0]
        void saveLeaderboardSetting({ source, boardId })
      }
      if (seq == sourceChangeSeqRef.current) {
        boundInfo.current = { source, id: boardId }
        musicListRef.current?.loadList(source, boardId)
      }
      void getBoardsList(source).then(list => {
        if (seq != sourceChangeSeqRef.current) return // init 迟到响应不覆盖已切换状态
        const bound = list.find(l => l.id == boardId)
        headerBarRef.current?.setBound(source, boardId, bound?.name ?? 'Unknown')
      }).catch(() => {
        // 榜单目录拉取失败：胶囊维持空名，主列表由 loadList 自行进 error 态
      })
    })

    // 摘源联动（批1 阶段2）：当前源不在新开启集→重置首项并应用其第一榜（空集=边界①保持）
    const handleSourcesUpdated = () => {
      const sources = boardState.sources
      if (!sources.length || sources.includes(boundInfo.current.source)) return
      const next = sources[0]
      void getBoardsList(next).then(list => {
        const board = list[0]
        sourceChangeSeqRef.current++
        boundInfo.current = { source: next, id: board.id }
        headerBarRef.current?.setBound(next, board.id, board.name ?? 'Unknown')
        handleBoundChange(next, board.id)
      }).catch(() => {})
    }
    global.state_event.on('sourcesUpdated', handleSourcesUpdated)
    return () => {
      global.state_event.off('sourcesUpdated', handleSourcesUpdated)
    }
  }, [])


  // 榜单胶囊子头：absolute 钉位+玻璃垫层渐显（后声明压列表之上，C-1 层级）。子头定位与列表
  // paddingTop 均消费宿主 contentPaddingTop（子头批审查 S-B：原弃用自算 headerTotal 双源并存）。
  // 未接线流内分支已删（2026-10-20 大标题批 I-4 定裁：唯一宿主 screens/Leaderboard 恒接线，
  // 横屏走 Horizontal 变体不经本组件——「无真实调用方即删」S-d 同例；对照 SongList/Content
  // 未接线分支有横屏 Home tab 真实调用方故保留）
  const headerBarElement = (
    <View
      style={{ ...styles.headerBar, top: contentPaddingTop, overflow: 'hidden' }}
      onLayout={(e) => { const h = e.nativeEvent.layout.height; setHeaderBarHeight(prev => Math.max(prev, h)) }}
    >
      {/* 渐显只作用于玻璃垫层，内容控件恒显（Search 终轮 C-2 同款） */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: subHeaderFade }]}>
        <GlassSurface style={StyleSheet.absoluteFill} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
      </Animated.View>
      <HeaderBar
        ref={headerBarRef}
        onBoundSelect={onBoundSelect}
        onSourceChange={onSourceChange}
        onPlay={onPlay}
        onCollect={onCollect}
      />
    </View>
  )

  // 边界①（批1 阶段2）：空源集切「全源不可用」提示态（sourcesUpdated 已订阅 bump 重渲染）
  const [, bumpRender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const listener = () => bumpRender()
    global.state_event.on('sourcesUpdated', listener)
    return () => {
      global.state_event.off('sourcesUpdated', listener)
    }
  }, [])

  return (
    <View style={styles.container}>
      {boardState.sources.length ? (
        <MusicList
          ref={musicListRef}
          scrollYAnimated={scrollYAnimated}
          contentPaddingTop={contentPaddingTop + headerBarHeight}
        />
      ) : (
        <SourcesOfflineTip />
      )}
      {headerBarElement}
    </View>
  )
}

const styles = createStyle({
  headerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
  },
})
