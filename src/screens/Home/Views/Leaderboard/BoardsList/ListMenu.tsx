import { useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import ActionSheet, { type ActionSheetItem, type ActionSheetType, type Position } from '@/components/common/ActionSheet'

export interface SelectInfo {
  listId: string
  name: string
  index: number
}
const initSelectInfo = {}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onCollect: (selectInfo: SelectInfo) => void
  onHideMenu: () => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

export default forwardRef<ListMenuType, ListMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<ActionSheetType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)

  useImperativeHandle(ref, () => ({
    show(selectInfo) {
      selectInfoRef.current = selectInfo
      if (visible) menuRef.current?.show()
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show()
        })
      }
    },
  }))

  const menus = useMemo<ActionSheetItem[]>(() => {
    return [
      { action: 'play', label: t('play'), icon: 'play' },
      { action: 'collect', label: t('collect'), icon: 'love' },
    ]
  }, [t])

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    const selectInfo = selectInfoRef.current
    switch (action) {
      case 'play':
        props.onPlay(selectInfo)
        break
      case 'collect':
        props.onCollect(selectInfo)
        break
      default:
        break
    }
  }

  return (
    visible
      ? <ActionSheet ref={menuRef} menus={menus} onPress={handleMenuPress} onHide={props.onHideMenu} />
      : null
  )
})

