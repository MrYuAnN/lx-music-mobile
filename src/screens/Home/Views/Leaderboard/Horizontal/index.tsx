import { useEffect, useReducer, useRef } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

import LeftBar, { type LeftBarType, type LeftBarProps } from './LeftBar'
import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import { getBoardsList } from '@/core/leaderboard'
import boardState from '@/store/leaderboard/state'
import SourcesOfflineTip from '@/components/common/SourcesOfflineTip'
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
      // 边界②（批1 阶段2）：持久化源已被摘→重置首项（对齐竖屏 Vertical 版）
      if (!boardState.sources.includes(source) && boardState.sources.length) {
        source = boardState.sources[0]
        void saveLeaderboardSetting({ source, boardId })
      }
      // 空源期显式短路（审查 S-4 防御深度，对齐竖屏）：现状靠条件渲染 ref 空窗隐式兜底
      if (!boardState.sources.length) return
      leftBarRef.current?.setBound(source, boardId)
      musicListRef.current?.loadList(source, boardId)
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
