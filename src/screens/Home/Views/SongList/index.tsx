import { useEffect, useRef, useState } from 'react'
import { Animated, View } from 'react-native'
import Content from './Content'
import TagList from './TagList'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { scaleSizeW } from '@/utils/pixelRatio'
import { createStyle, isHorizontalMode } from '@/utils/tools'
import { useBackHandler } from '@/utils/hooks'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { navigations } from '@/navigation'
import settingState from '@/store/setting/state'

const ANIM_DURATION = 200

// 面板关闭/卸载后按当前设置与横竖屏恢复主抽屉（直读 settingState 避免闭包旧值；横屏不启用）
const restoreDrawer = () => {
  const position = settingState.setting['common.drawerLayoutPosition']
  const { width, height } = windowSizeTools.getSize()
  navigations.syncDrawerLayout(!!width && !isHorizontalMode(width, height), position)
}

// 筛选面板（题①：原抽屉侧栏页内化；宽度等价原配置 80% 屏宽、上限 scaleSizeW(560)；常挂载保留 TagList 内部状态）
export default () => {
  const theme = useTheme()
  const [panelVisible, setPanelVisible] = useState(false)
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')
  const panelWidth = Math.min(windowSizeTools.getSize().width * 0.8, scaleSizeW(560))
  // 初始位移按关闭方向，避免首帧面板闪现
  const panelTranslate = useRef(new Animated.Value(drawerLayoutPosition == 'right' ? panelWidth : -panelWidth)).current
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
        toValue: panelVisible ? 0 : (drawerLayoutPosition == 'right' ? panelWidth : -panelWidth),
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(maskOpacity, {
        toValue: panelVisible ? 1 : 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start()
  }, [panelVisible, panelTranslate, maskOpacity, drawerLayoutPosition, panelWidth])

  // 面板打开时返回键先关面板（Android 平台惯例）
  useBackHandler(() => {
    if (!panelVisible) return false
    hidePanel()
    return true
  })

  useEffect(() => {
    const handleShow = () => {
      showPanel()
    }
    const handleHide = () => {
      hidePanel()
    }

    global.app_event.on('showSonglistTagList', handleShow)
    global.app_event.on('hideSonglistTagList', handleHide)

    // 卸载兜底：iOS 侧滑返回等未走 hidePanel 的离开路径，恢复主抽屉手势（题①复核 4b）
    return () => {
      global.app_event.off('showSonglistTagList', handleShow)
      global.app_event.off('hideSonglistTagList', handleHide)
      restoreDrawer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.container}>
      <Content />
      <Animated.View
        style={{
          ...styles.mask,
          opacity: maskOpacity,
        }}
        pointerEvents={panelVisible ? 'auto' : 'none'}
        onStartShouldSetResponder={() => {
          global.app_event.hideSonglistTagList()
          return true
        }}
      />
      <Animated.View
        style={{
          ...styles.panel,
          ...(drawerLayoutPosition == 'right' ? styles.panelRight : styles.panelLeft),
          width: panelWidth,
          transform: [{ translateX: panelTranslate }],
          backgroundColor: theme['c-content-background'],
        }}
      >
        <TagList />
      </Animated.View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    position: 'relative',
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
