import { forwardRef, useImperativeHandle, useRef } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'

import SheetBase, { type SheetBaseType } from './SheetBase'
import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { hapticSelection } from '@/utils/haptic'

// 底部单选弹层（弹窗体系方案 §问题8，参考图2）：标题+选项列表+当前项右侧勾选。
// 音质切换、播放模式等互斥选择的标准容器。
export interface CheckSheetItem {
  action: string
  label: string
  disabled?: boolean
}

export interface CheckSheetProps {
  title: string
  options: Readonly<CheckSheetItem[]>
  /** 当前选中项 action */
  value: string
  onPress: (item: CheckSheetItem) => void
  onHide?: () => void
}

export interface CheckSheetType {
  show: () => void
  hide: () => void
}

const ITEM_HEIGHT = scaleSizeH(48)

const CheckSheet = ({
  title,
  options,
  value,
  onPress,
  onHide,
}: CheckSheetProps, ref: React.Ref<CheckSheetType>) => {
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

  const handlePress = (item: CheckSheetItem) => {
    hapticSelection()
    onPress(item)
    sheetRef.current?.setVisible(false)
  }

  return (
    <SheetBase ref={sheetRef} title={title} onHide={onHide} maxHeight="62%">
      <ScrollView style={styles.list} keyboardShouldPersistTaps="always">
        {
          options.map(item => {
            const checked = item.action == value
            return (
              <TouchableOpacity
                key={item.action}
                style={styles.item}
                activeOpacity={0.6}
                disabled={item.disabled}
                onPress={() => { handlePress(item) }}
              >
                <Text
                  size={15}
                  color={item.disabled ? theme['c-font-label'] : theme['c-font']}
                  numberOfLines={1}
                  style={styles.label}
                >{item.label}</Text>
                {
                  checked
                    ? <Icon name="checkbox-marked" size={20} color={theme['c-primary']} style={styles.checkIcon} />
                    : null
                }
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>
    </SheetBase>
  )
}

const styles = createStyle({
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
  label: {
    flex: 1,
    flexShrink: 1,
  },
  checkIcon: {
    marginLeft: scaleSizeW(12),
  },
})

export default forwardRef(CheckSheet) as (p: CheckSheetProps & { ref?: React.Ref<CheckSheetType> }) => JSX.Element | null
