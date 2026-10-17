import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import HeaderBar, { type HeaderBarType, type HeaderBarProps } from './HeaderBar'
import { getBoardsList } from '@/core/leaderboard'
import { handleCollect, handlePlay } from '../listAction'
import boardState from '@/store/leaderboard/state'

// 排行榜竖屏页（拍板定稿）：顶栏单胶囊 + 级联 sheet 取代原「音源下拉+榜单名按钮+侧抽屉」；
// DrawerLayoutFixed 与 BoardsList 引用已摘除（BoardsList 组件保留，横屏 LeftBar 仍在用）。
// 并发口径（代码审查 I-A/I-B 收口）：切源的数据获取单链在 sheet（seq 守卫在彼处），
// 本组件 sourceChangeSeqRef 仅用于使冷启动 init 的迟到响应失效；onSourceChange 以完整
// (source, board) 同步应用，boundInfo 不再有 source/id 分步写入的混合窗口。
export default () => {
  const musicListRef = useRef<MusicListType>(null)
  const headerBarRef = useRef<HeaderBarType>(null)
  const boundInfo = useRef<{ source: LX.OnlineSource, id: string | null }>({ source: 'kw', id: null })
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
    void getLeaderboardSetting().then(({ source, boardId }) => {
      // boundInfo 写入与 loadList 同样纳入 seq 守卫：用户在途选榜/切源不被 init 各阶段覆盖
      // （三席审查 #7 守卫补全，此前只包 setBound）
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
  }, [])


  return (
    <View style={styles.container}>
      <HeaderBar
        ref={headerBarRef}
        onBoundSelect={onBoundSelect}
        onSourceChange={onSourceChange}
        onPlay={onPlay}
        onCollect={onCollect}
      />
      <MusicList ref={musicListRef} />
    </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
  },
})
