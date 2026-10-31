import { version } from '../../../package.json'

export interface VersionInfo {
  version: string
  desc: string
  history?: SY.VersionInfo[]
  url?: string
}

export interface InitState {
  showModal: boolean
  versionInfo: {
    version: string
    newVersion: VersionInfo | null
    showModal: boolean
    isUnknown: boolean
    isLatest: boolean
    reCheck: boolean
    status: SY.UpdateStatus
  }
  ignoreVersion: string | null
  /** ⑤ min_client_version 强更（批2）：/config 冷启动一次判定（config.ts），可关闭弹窗+跳 upgrade_url */
  upgradeRequired: { required: boolean, url: string }
}

const state: InitState = {
  showModal: false,
  versionInfo: {
    version,
    newVersion: null,
    showModal: false,
    reCheck: false,
    isUnknown: false,
    isLatest: false,
    status: 'checking',
  },
  ignoreVersion: null,
  upgradeRequired: { required: false, url: '' },
}


export default state
