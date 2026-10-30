import defaultSetting from '@/config/defaultSetting'


interface InitState {
  setting: SY.AppSetting
}

const state: InitState = {
  setting: { ...defaultSetting },
}


export default state
