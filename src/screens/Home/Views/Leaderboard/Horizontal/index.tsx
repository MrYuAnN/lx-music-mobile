import { useEffect, useReducer, useRef } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

import LeftBar, { type LeftBarType, type LeftBarProps } from './LeftBar'
import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import boardState from '@/store/leaderboard/state'
import SourcesOfflineTip from '@/components/common/SourcesOfflineTip'
// import { BorderWidths } from '@/theme'
// import { useTheme } from '@/store/theme/hook'


export default () => {
  const leftBarRef = useRef<LeftBarType>(null)
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  // const theme = useTheme()

  const handleChangeBound: LeftBarProps['onChangeList'] = (source, id) => {
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
      leftBarRef.current?.setBound(source, boardId)
      musicListRef.current?.loadList(source, boardId)
    })

    return () => {
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
