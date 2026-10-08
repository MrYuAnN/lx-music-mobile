import { type COMPONENT_IDS } from '@/config/constant'


export interface InitState {
  fontSize: number
  statusbarHeight: number
  componentIds: Partial<Record<COMPONENT_IDS, string>>
  sourceNames: Record<LX.OnlineSource | 'all', string>
  bgPic: string | null
}

const initData = {}

const state: InitState = {
  fontSize: global.lx.fontSize,
  statusbarHeight: 0,
  componentIds: {},
  sourceNames: initData as InitState['sourceNames'],
  bgPic: null,
}


export default state
