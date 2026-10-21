import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'

import Basic from './settings/Basic'
import Player from './settings/Player'
import LyricDesktop from './settings/LyricDesktop'
import Search from './settings/Search'
import List from './settings/List'
import Download from './settings/Download'
import Sync from './settings/Sync'
import Backup from './settings/Backup'
import Other from './settings/Other'
import About from './settings/About'

// 节清单单源（2026-10-21 设置页重构：标准重组十节，version 并入 about；伴生 COMPONENTS
// Record 查表渲染——横竖两 Main 共用，缺键 tsc 即失败，修复「数组单源/switch 双源」的
// 竖屏缺挂 download 类事故结构洞）
export const SETTING_SCREENS = [
  'basic',
  'player',
  'download',
  'list',
  'search',
  'lyric_desktop',
  'sync',
  'backup',
  'other',
  'about',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number]

export const SETTING_COMPONENTS: Record<SettingScreenIds, React.ComponentType> = {
  basic: Basic,
  player: Player,
  download: Download,
  list: List,
  search: Search,
  lyric_desktop: LyricDesktop,
  sync: Sync,
  backup: Backup,
  other: Other,
  about: About,
}

export interface MainType {
  setActiveId: (id: SettingScreenIds) => void
}

const Main = forwardRef<MainType, {}>((props, ref) => {
  const [id, setId] = useState(global.lx.settingActiveId)

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
    return <Section />
  }, [id])

  return component
})


export default Main
