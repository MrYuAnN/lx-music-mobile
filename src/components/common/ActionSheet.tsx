import { forwardRef, useImperativeHandle, useRef, type Ref } from 'react'
import { Animated, ScrollView, TouchableOpacity, View } from 'react-native'

import Modal, { type ModalType } from './Modal'
import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { hapticSelection } from '@/utils/haptic'
import { AM_EASE_DURATION, amEase } from '@/utils/animation'
import { useWindowSize } from '@/utils/hooks'

// 底部 sheet 形态的上下文菜单（AM 歌曲菜单形态，AM-5），
// 替代锚定浮层版 Menu 在歌曲/歌单菜单场景的使用；position 参数为兼容旧签名保留不使用。
export interface Position { w: number, h: number, x: number, y: number }
export type { Position as MenuPosition } from './Menu'

export interface ActionSheetItem {
  action: string
  label: string
  disabled?: boolean
  icon?: string
  destructive?: boolean
}

export interface ActionSheetProps {
  menus: Readonly<ActionSheetItem[]>
  onPress: (menu: ActionSheetItem) => void
  onHide?: () => void
  title?: string
}

export interface ActionSheetType {
  show: (position?: Position, menuSize?: { width?: number, height?: number }) => void
  hide: () => void
}

const ITEM_HEIGHT = scaleSizeH(48)

// 底部 sheet 把手条共享样式（ActionSheet 与 PlayListPanel 单源，防两处漂移）
export const sheetHandleStyles = createStyle({
  handle: {
    alignItems: 'center',
    paddingTop: scaleSizeH(8),
    paddingBottom: scaleSizeH(2),
  },
  handleBar: {
    width: scaleSizeW(36),
    height: scaleSizeH(4),
    borderRadius: scaleSizeW(2),
    opacity: 0.4,
  },
})

const ActionSheet = ({ menus, onPress, onHide, title }: ActionSheetProps, ref: Ref<ActionSheetType>) => {
  const theme = useTheme()
  const modalRef = useRef<ModalType>(null)
  const windowSize = useWindowSize()
  const slideAnim = useRef(new Animated.Value(0)).current

  useImperativeHandle(ref, () => ({
    show() {
      // 底部 sheet 上滑入场（Modal 内容挂载后从屏幕底滑入；遮罩沿用 Modal 自身 fade）
      slideAnim.setValue(windowSize.height)
      modalRef.current?.setVisible(true)
      requestAnimationFrame(() => {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: AM_EASE_DURATION,
          easing: amEase,
          useNativeDriver: true,
        }).start()
      })
    },
    hide() {
      modalRef.current?.setVisible(false)
    },
  }))

  const menuPress = (menu: ActionSheetItem) => {
    hapticSelection()
    onPress(menu)
    modalRef.current?.setVisible(false)
  }

  return (
    <Modal onHide={onHide} ref={modalRef} bgColor="rgba(50,50,50,.2)">
      {/* responder 声明只放 sheet 容器：遮罩区留给 Modal 的背景点击关闭（与旧 Menu 同机制） */}
      <View style={styles.overlay}>
        <Animated.View
          style={{ ...styles.sheet, backgroundColor: theme['c-content-background'], transform: [{ translateY: slideAnim }] }}
          onStartShouldSetResponder={() => true}
        >
          <View style={sheetHandleStyles.handle}>
            <View style={{ ...sheetHandleStyles.handleBar, backgroundColor: theme['c-font-label'] }} />
          </View>
          {
            title
              ? (
                  <View style={styles.title}>
                    <Text size={13} color={theme['c-font-label']} numberOfLines={1}>{title}</Text>
                  </View>
                )
              : null
          }
          <ScrollView style={styles.list} keyboardShouldPersistTaps="always">
            {
              menus.map(menu => (
                menu.disabled
                  ? (
                      <View key={menu.action} style={styles.item}>
                        <Icon name={menu.icon ?? 'full_stop'} size={ICON_SIZE.list} color={theme['c-font-label']} style={styles.icon} />
                        <Text size={15} color={theme['c-font-label']} numberOfLines={1} style={styles.label}>{menu.label}</Text>
                      </View>
                    )
                  : (
                      <TouchableOpacity
                        key={menu.action}
                        style={styles.item}
                        activeOpacity={0.6}
                        onPress={() => { menuPress(menu) }}
                      >
                        <Icon
                          name={menu.icon ?? 'full_stop'}
                          size={ICON_SIZE.list}
                          // destructive 红语义独立于品牌色（HIG 惯例不随 tint），取 AM 双态红常量
                          color={menu.destructive ? (theme.isDark ? '#FB4B54' : '#FA233B') : theme['c-font']}
                          style={styles.icon}
                        />
                        <Text size={15} color={menu.destructive ? (theme.isDark ? '#FB4B54' : '#FA233B') : theme['c-font']} numberOfLines={1} style={styles.label}>{menu.label}</Text>
                      </TouchableOpacity>
                    )
              ))
            }
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = createStyle({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '62%',
    borderTopLeftRadius: scaleSizeW(16),
    borderTopRightRadius: scaleSizeW(16),
    paddingBottom: scaleSizeH(12),
  },
  title: {
    paddingHorizontal: scaleSizeW(20),
    paddingTop: scaleSizeH(6),
    paddingBottom: scaleSizeH(2),
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSizeW(20),
  },
  icon: {
    width: scaleSizeW(30),
  },
  label: {
    paddingLeft: scaleSizeW(12),
  },
})

export default forwardRef(ActionSheet) as (p: ActionSheetProps & { ref?: Ref<ActionSheetType> }) => JSX.Element | null
