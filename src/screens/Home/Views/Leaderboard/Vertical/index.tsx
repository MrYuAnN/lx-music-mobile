import { useEffect, useRef, useState } from 'react'
import { Animated, View } from 'react-native'
import { createStyle, isHorizontalMode } from '@/utils/tools'

import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import HeaderBar, { type HeaderBarType, type HeaderBarProps } from './HeaderBar'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useBackHandler } from '@/utils/hooks'
// import { BorderWidths } from '@/theme'
// import { useTheme } from '@/store/theme/hook'
import BoardsList, { type BoardsListType, type BoardsListProps } from '../BoardsList'
import { getBoardsList } from '@/core/leaderboard'
import { handleCollect, handlePlay } from '../listAction'
import boardState from '@/store/leaderboard/state'
import { navigations } from '@/navigation'
import settingState from '@/store/setting/state'
import { windowSizeTools } from '@/utils/windowSizeTools'


const PANEL_WIDTH = scaleSizeW(200)
const ANIM_DURATION = 200

// 面板关闭/卸载后按当前设置与横竖屏恢复主抽屉（直读 settingState 避免闭包旧值；横屏不启用）
const restoreDrawer = () => {
  const position = settingState.setting['common.drawerLayoutPosition']
  const { width, height } = windowSizeTools.getSize()
  navigations.syncDrawerLayout(!!width && !isHorizontalMode(width, height), position)
}

export default () => {
  const theme = useTheme()
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  const boardsListRef = useRef<BoardsListType>(null)
  const headerBarRef = useRef<HeaderBarType>(null)
  const boundInfo = useRef<{ source: LX.OnlineSource, id: string | null }>({ source: 'kw', id: null })
  // 筛选面板（题①：原抽屉侧栏页内化，常挂载以保留列表数据；初始位移按关闭方向，避免首帧闪现）
  const [panelVisible, setPanelVisible] = useState(false)
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')
  const panelTranslate = useRef(new Animated.Value(drawerLayoutPosition == 'right' ? PANEL_WIDTH : -PANEL_WIDTH)).current
  const maskOpacity = useRef(new Animated.Value(0)).current

  const showPanel = () => {
    setPanelVisible(true)
    // 面板浮层期间锁定主抽屉手势，避免双抽屉叠加（题①审查）
    navigations.syncDrawerLayout(false, settingState.setting['common.drawerLayoutPosition'])
  }
  const hidePanel = () => {
    setPanelVisible(false)
    restoreDrawer()
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(panelTranslate, {
        toValue: panelVisible ? 0 : (drawerLayoutPosition == 'right' ? PANEL_WIDTH : -PANEL_WIDTH),
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(maskOpacity, {
        toValue: panelVisible ? 1 : 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start()
  }, [panelVisible, panelTranslate, maskOpacity, drawerLayoutPosition])

  // 面板打开时返回键先关面板（Android 平台惯例）
  useBackHandler(() => {
    if (!panelVisible) return false
    hidePanel()
    return true
  })

  const handleBoundChange = (source: LX.OnlineSource, id: string) => {
    musicListRef.current?.loadList(source, id)
    void saveLeaderboardSetting({
      source,
      boardId: id,
    })
  }
  const onBoundChange: BoardsListProps['onBoundChange'] = (id) => {
    boundInfo.current.id = id
    void getBoardsList(boundInfo.current.source).then(list => {
      requestAnimationFrame(() => {
        const bound = list.find(l => l.id == id)
        headerBarRef.current?.setBound(boundInfo.current.source, id, bound?.name ?? 'Unknown')
      })
    })
    handleBoundChange(boundInfo.current.source, id)
    requestAnimationFrame(() => {
      hidePanel()
    })
  }
  const onPlay: BoardsListProps['onPlay'] = (id) => {
    boundInfo.current.id = id
    void handlePlay(id, boardState.listDetailInfo.list)
  }
  const onCollect: BoardsListProps['onCollect'] = (id, name) => {
    boundInfo.current.id = id
    void handleCollect(id, name, boundInfo.current.source)
  }
  const onShowBound = () => {
    showPanel()
  }
  const onSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    boundInfo.current.source = source
    void getBoardsList(source).then(list => {
      const id = list[0].id
      const name = list[0].name
      requestAnimationFrame(() => {
        boardsListRef.current?.setList(list, id)
        headerBarRef.current?.setBound(source, id, name ?? 'Unknown')
        requestAnimationFrame(() => {
          handleBoundChange(source, id)
        })
      })
    })
  }


  useEffect(() => {
    isUnmountedRef.current = false
    void getLeaderboardSetting().then(({ source, boardId }) => {
      boundInfo.current.source = source
      boundInfo.current.id = boardId
      void getBoardsList(source).then(list => {
        const bound = list.find(l => l.id == boardId)
        boardsListRef.current?.setList(list, boardId)
        headerBarRef.current?.setBound(source, boardId, bound?.name ?? 'Unknown')
      })
      musicListRef.current?.loadList(source, boardId)
    })

    return () => {
      isUnmountedRef.current = true
      // 卸载兜底：iOS 侧滑返回等未走 hidePanel 的离开路径，恢复主抽屉手势（题①复核 4b）
      restoreDrawer()
    }
  }, [])


  return (
    <View style={styles.container}>
      <HeaderBar ref={headerBarRef} onShowBound={onShowBound} onSourceChange={onSourceChange} />
      <MusicList ref={musicListRef} />
      <Animated.View
        style={{
          ...styles.mask,
          opacity: maskOpacity,
        }}
        pointerEvents={panelVisible ? 'auto' : 'none'}
        onStartShouldSetResponder={() => {
          hidePanel()
          return true
        }}
      />
      <Animated.View
        style={{
          ...styles.panel,
          ...(drawerLayoutPosition == 'right' ? styles.panelRight : styles.panelLeft),
          transform: [{ translateX: panelTranslate }],
          backgroundColor: theme['c-content-background'],
        }}
      >
        <BoardsList
          ref={boardsListRef}
          onBoundChange={onBoundChange}
          onCollect={onCollect}
          onPlay={onPlay}
        />
      </Animated.View>
    </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    // borderTopWidth: BorderWidths.normal,
  },
  mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    zIndex: 11,
    elevation: 4,
  },
  panelLeft: {
    left: 0,
  },
  panelRight: {
    right: 0,
  },
})
