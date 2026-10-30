import { type NAV_ID_Type, type COMPONENT_IDS } from '@/config/constant'


export interface InitState {
  fontSize: number
  statusbarHeight: number
  componentIds: Partial<Record<COMPONENT_IDS, string>>
  navActiveId: NAV_ID_Type
  lastNavActiveId: NAV_ID_Type
  sourceNames: Record<SY.OnlineSource | 'all', string>
}

const initData = {}

const state: InitState = {
  fontSize: global.sy.fontSize,
  statusbarHeight: 0,
  componentIds: {},
  // 横竖屏冷启动落点同构（2026-10-23 拍板 #9）：初始首页，互切保留最后 pane（setNavActiveId 现状语义）
  navActiveId: 'nav_home',
  lastNavActiveId: 'nav_home',
  sourceNames: initData as InitState['sourceNames'],
}


export default state
