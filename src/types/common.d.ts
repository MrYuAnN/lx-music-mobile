// import './app_setting'

declare namespace LX {
  type OnlineSource = 'kw' | 'kg' | 'tx' | 'wy' | 'mg'
  type Source = OnlineSource | 'local'
  type Quality = '128k' | '320k' | 'flac' | 'flac24bit' | '192k' | 'ape' | 'wav'
  type QualityList = Partial<Record<LX.Source, LX.Quality[]>>

  type ShareType = 'system' | 'clipboard'

  // 批1 阶段4：下载改跳浏览器，downloading/downloaded 态退役
  type UpdateStatus = 'error' | 'checking' | 'idle'
  interface VersionInfo {
    version: string
    desc: string
  }
}
