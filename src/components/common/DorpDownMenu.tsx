import { useMemo, useRef } from 'react'

import Menu, { menuItemWidth, type MenuType, type MenuProps, type Menus } from './Menu'
import Button, { type BtnType, type BtnProps } from './Button'
import { useWindowSize } from '@/utils/hooks'
import { SPACING } from '@/config/spacing'

export interface DorpDownMenuProps<T extends Menus> extends Omit<MenuProps<T>, 'width'> {
  children: React.ReactNode
  btnStyle?: BtnProps['style']
  // 菜单宽自适应内容（搜索页窄触发器防截断）：按最长 label 估宽经 show(position, menuSize) 传入，
  // 覆盖默认「菜单宽=触发器宽」；验收口径=最长 label 完整可见（估宽偏小时会省略号，非像素级 fit）
  fitMenuWidth?: boolean
}

// CJK 全宽字符（汉字/全宽标点/全宽拉丁）按一个字宽计，其余按 0.6 估算
const isFullWidthChar = (ch: string) => {
  const code = ch.codePointAt(0) ?? 0
  return (code >= 0x2e80 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xff00 && code <= 0xffef)
}
const estimateMenuWidth = (menus: Menus, fontSize: number): number => {
  let maxLabelWidth = 0
  for (const menu of menus) {
    let labelWidth = 0
    for (const ch of menu.label) labelWidth += isFullWidthChar(ch) ? fontSize : fontSize * 0.6
    if (labelWidth > maxLabelWidth) maxLabelWidth = labelWidth
  }
  return maxLabelWidth + SPACING.s10 * 2 + 8
}

export default <T extends Menus>({
  menus,
  onPress,
  height,
  fontSize,
  center,
  children,
  activeId,
  btnStyle,
  fitMenuWidth,
}: DorpDownMenuProps<T>) => {
  const buttonRef = useRef<BtnType>(null)
  const menuRef = useRef<MenuType>(null)
  const windowSize = useWindowSize()
  const fitWidth = useMemo(() => {
    if (!fitMenuWidth) return 0
    // clamp：不小于 Menu 兜底宽（同源 menuItemWidth），不超出窗口（留边距供定位翻转）
    const estimated = estimateMenuWidth(menus, fontSize ?? 15)
    return Math.min(Math.max(estimated, menuItemWidth), windowSize.width - 24)
  }, [fitMenuWidth, menus, fontSize, windowSize.width])

  const showMenu = () => {
    buttonRef.current?.measure((fx, fy, width, height, px, py) => {
      // console.log(fx, fy, width, height, px, py)
      const menuSize = fitWidth ? { width: fitWidth, height } : { width, height }
      menuRef.current?.show({ x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) }, menuSize)
    })
  }

  return (
    <Button style={btnStyle} ref={buttonRef} onPress={showMenu}>
      {children}
      <Menu
        ref={menuRef}
        menus={menus}
        center={center}
        onPress={onPress}
        fontSize={fontSize}
        height={height}
        activeId={activeId}
      />
    </Button>
  )
}
