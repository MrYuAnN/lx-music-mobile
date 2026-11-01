import { useEffect, useReducer, useRef } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

import LeftBar, { type LeftBarType, type LeftBarProps } from './LeftBar'
import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import { getBoardsList } from '@/core/leaderboard'
import boardState from '@/store/leaderboard/state'
import SourcesOfflineTip from '@/components/common/SourcesOfflineTip'
import { ensureShiyinSources } from '@/core/shiyin/config'
// import { BorderWidths } from '@/theme'
// import { useTheme } from '@/store/theme/hook'


export default () => {
  const leftBarRef = useRef<LeftBarType>(null)
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  // const theme = useTheme()
  // 用户手动操作标志（代码审查 I-1）：横屏无 seq 机制，恢复分支迟到响应用它让位
  const userTouchedRef = useRef(false)

  const handleChangeBound: LeftBarProps['onChangeList'] = (source, id) => {
    // 空源期交互入口守卫（复审 R2-v3，同构竖屏）：tip 态禁发请求
    if (!boardState.sources.length) return
    userTouchedRef.current = true
    musicListRef.current?.loadList(source, id)
    void saveLeaderboardSetting({
      source,
      boardId: id,
    })
  }

  useEffect(() => {
    isUnmountedRef.current = false
    void getLeaderboardSetting().then((setting) => {
      let { source, boardId } = setting
      // 边界②（批1 阶段2）：持久化源已被摘→重置首项（对齐竖屏 Vertical 版；boardId 不在此
      // 落盘——与源耦合的旧 id 属脏组合，待下方目录 resolve 有效后统一落盘）
      if (!boardState.sources.includes(source) && boardState.sources.length) {
        source = boardState.sources[0]
      }
      // 空源期显式短路（审查 S-4 防御深度，对齐竖屏）：现状靠条件渲染 ref 空窗隐式兜底
      if (!boardState.sources.length) return
      // 绑定组合校验（对齐竖屏 qq unknown 根治）：榜 id 与源耦合（{source}__{bangId}），
      // 为空或跨源前缀必无效——摘除停发请求，待目录返回回退该源第一榜；?. 防持久化畸形值
      // 非 string 崩溃（审查 S2）
      if (!boardId?.startsWith(`${source}__`)) boardId = ''
      if (boardId) {
        leftBarRef.current?.setBound(source, boardId)
        musicListRef.current?.loadList(source, boardId)
      }
      void getBoardsList(source).then(list => {
        // 用户手动操作让位（代码审查 I-1，同构恢复分支守卫）
        if (isUnmountedRef.current || userTouchedRef.current) return
        const board = list.find(b => b.id == boardId) ?? list[0]
        // 目录空无榜可绑；有效组合高亮已由上方 setBound 完成
        if (!board || board.id == boardId) {
          // boardId 已清空时 loadList 从未调用，主列表会停留无反馈空态（审查 I-1）——
          // 显式发空 id 请求走 error 链
          if (!boardId) musicListRef.current?.loadList(source, boardId)
          return
        }
        // 组合无效（新装默认源被摘/boardId 空/同源榜 id 过期）→回退该源第一榜（对齐竖屏
        // find ?? list[0] 口径）：修正高亮+补加载+落盘
        boardId = board.id
        leftBarRef.current?.setBound(source, board.id)
        musicListRef.current?.loadList(source, board.id)
        void saveLeaderboardSetting({ source, boardId })
      }).catch(() => {
        // 目录拉取失败：有效组合已由上方 loadList 进 error 态；boardId 已清空时
        // loadList 从未调用（审查 I-1）——显式发空 id 请求走 error 链
        if (!boardId) musicListRef.current?.loadList(source, boardId)
      })
    })

    // 摘源联动+空集恢复（复审 R4，对齐竖屏 Vertical：空→非空恢复补拉；恢复分支摘源守卫
    // R2-v3——绑定源已被摘先改绑首项，MusicList/LeftBar 条件渲染下 ref 空窗由 rAF 自愈）
    let prevSourcesEmpty = boardState.sources.length == 0
    const handleSourcesUpdated = () => {
      const sources = boardState.sources
      const wasEmpty = prevSourcesEmpty
      prevSourcesEmpty = !sources.length
      if (!(wasEmpty && sources.length)) return
      void getLeaderboardSetting().then((setting) => {
        if (isUnmountedRef.current) return
        let { source, boardId } = setting
        if (!sources.includes(source)) {
          source = sources[0]
          boardId = ''
        }
        requestAnimationFrame(() => {
          void getBoardsList(source).then(list => {
            // 用户手动操作让位（代码审查 I-1，同构竖屏 seq 守卫）
            if (isUnmountedRef.current || userTouchedRef.current) return
            const board = list.find(b => b.id == boardId) ?? list[0]
            if (!board) return
            leftBarRef.current?.setBound(source, board.id)
            musicListRef.current?.loadList(source, board.id)
            // 恢复补拉落盘（审查 S-1，对齐竖屏经 handleBoundChange 落盘的形态）
            void saveLeaderboardSetting({ source, boardId: board.id })
          }).catch(() => {})
        })
      })
    }
    global.state_event.on('sourcesUpdated', handleSourcesUpdated)
    return () => {
      global.state_event.off('sourcesUpdated', handleSourcesUpdated)
      isUnmountedRef.current = true
    }
  }, [])

  // 边界①（批1 阶段2）：空源集切「全源不可用」提示态（横竖屏形态对齐）
  const [, bumpRender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    // 空集即拉（新装空窗反馈）：进页若无源集立即补一次 /config，不等自愈链节拍
    ensureShiyinSources()
    const listener = () => bumpRender()
    global.state_event.on('sourcesUpdated', listener)
    return () => {
      global.state_event.off('sourcesUpdated', listener)
    }
  }, [])

  return (
    <View style={styles.container}>
      {boardState.sources.length ? (
        <>
          <LeftBar
            ref={leftBarRef}
            onChangeList={handleChangeBound}
          />
          <MusicList
            ref={musicListRef}
          />
        </>
      ) : (
        <SourcesOfflineTip />
      )}
    </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'row',
    // borderTopWidth: BorderWidths.normal,
  },
  content: {
    flex: 1,
  },
})
