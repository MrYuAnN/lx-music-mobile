import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'

import Basic from './settings/Basic'
import Player from './settings/Player'
import LyricDesktop from './settings/LyricDesktop'
import Search from './settings/Search'
import Download from './settings/Download'
import Backup from './settings/Backup'
import Other from './settings/Other'
import About from './settings/About'
import Activation from './settings/Activation'

// 节清单单源（2026-10-21 设置页重构：标准重组十节，version 并入 about；伴生 COMPONENTS
// Record 查表渲染——缺键 tsc 即失败，修复「数组单源/switch 双源」的竖屏缺挂 download 类
// 事故结构洞）。
// 批 R 形态修订（2026-11-01 用户拍板净屏式根菜单，推翻 2026-10-23 竖屏九节平铺）：竖屏
// 平铺退役改根菜单；本查表转**双端共用**（D8 收口）——横屏 Main 切换器 + 竖屏二级页宿主
// SettingSectionScreen 均按 id 查此 Record 渲染；`activation`/`about` 两节组件保留
// （横屏仍渲染），竖屏不再引用（类型防线=SettingSectionTarget 收窄七节子集）。
export const SETTING_SCREENS = [
  'activation',
  'basic',
  'player',
  'download',
  'search',
  'lyric_desktop',
  'backup',
  'other',
  'about',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number]

// 竖屏二级页可达节（批 R：activation/about 提升根菜单直达，不经二级页）——
// push 函数/宿主 props/根菜单行 target 统一用此收窄类型，tsc 拦截误推已退役节
export type SettingSectionTarget = Exclude<SettingScreenIds, 'activation' | 'about'>

export const SETTING_COMPONENTS: Record<SettingScreenIds, React.ComponentType<{ first?: boolean }>> = {
  activation: Activation,
  basic: Basic,
  player: Player,
  download: Download,
  search: Search,
  lyric_desktop: LyricDesktop,
  backup: Backup,
  other: Other,
  about: About,
}

export interface MainType {
  setActiveId: (id: SettingScreenIds) => void
}

// 横屏专用节切换器（批 R 后唯一消费方=Horizontal/index.tsx；竖屏根菜单见 Vertical/Main.tsx）
const Main = forwardRef<MainType, {}>((props, ref) => {
  const [id, setId] = useState(global.sy.settingActiveId)

  useImperativeHandle(ref, () => ({
    setActiveId(id) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setId(id)
        })
      })
    },
  }))

  const component = useMemo(() => {
    const Section = SETTING_COMPONENTS[id]
    return <Section first />
  }, [id])

  return component
})


export default Main
