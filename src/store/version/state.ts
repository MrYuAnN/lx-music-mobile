import { version } from '../../../package.json'

export interface VersionInfo {
  version: string
  desc: string
  history?: LX.VersionInfo[]
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
    status: LX.UpdateStatus
  }
  ignoreVersion: string | null
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
}


export default state
