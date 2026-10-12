import { forwardRef, useImperativeHandle, useRef, type Ref, type JSX } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import SheetBase, { sheetHandleStyles, type SheetBaseType } from './SheetBase'
import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { hapticSelection } from '@/utils/haptic'

// 底部 sheet 形态的上下文菜单（AM 歌曲菜单形态，AM-5；弹窗体系批升级为 SheetBase 基座：spring 入场+把手/标题区下拉关闭）。
// 把手条样式单源在 SheetBase（与 PlayListPanel 共用）。
export interface Position { w: number, h: number, x: number, y: number }
export interface ActionSheetItem {
  action: string
  label: string
  disabled?: boolean
  icon?: string
  destructive?: boolean
}

export interface ActionSheetProps {
  menus: readonly ActionSheetItem[]
  onPress: (menu: ActionSheetItem) => void
  onHide?: () => void
  title?: string
}

export interface ActionSheetType {
  show: () => void
  hide: () => void
}

const ITEM_HEIGHT = scaleSizeH(48)

const ActionSheet = ({ menus, onPress, onHide, title }: ActionSheetProps, ref: Ref<ActionSheetType>) => {
  const theme = useTheme()
  const sheetRef = useRef<SheetBaseType>(null)

  useImperativeHandle(ref, () => ({
    show() {
      sheetRef.current?.setVisible(true)
    },
    hide() {
      sheetRef.current?.setVisible(false)
    },
  }))

  const menuPress = (menu: ActionSheetItem) => {
    hapticSelection()
    onPress(menu)
    sheetRef.current?.setVisible(false)
  }

  return (
    <SheetBase ref={sheetRef} onHide={onHide} maxHeight="62%">
      {
        title
          ? (
              <View style={styles.title}>
                <Text size={13} color={theme['c-font-label']} numberOfLines={1}>{title}</Text>
              </View>
            )
          : null
      }
      <ScrollView style={styles.list} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
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
    </SheetBase>
  )
}

const styles = createStyle({
  title: {
    paddingHorizontal: scaleSizeW(20),
    paddingTop: scaleSizeH(6),
    paddingBottom: scaleSizeH(2),
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
    paddingBottom: scaleSizeH(12),
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
export { sheetHandleStyles }
