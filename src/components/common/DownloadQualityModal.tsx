import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Linking, NativeModules } from 'react-native'

import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import { useI18n } from '@/lang'
import { PLAY_QUALITY_LIST } from '@/core/music/utils'
import { qualityLabel, qualityLabelMarked } from '@/utils/music'
import { addDownloadTask } from '@/core/download'
import { action as downloadedAction } from '@/store/downloaded'
import { toast } from '@/utils/tools'
import { ensureStoragePermission } from '@/utils/permissions'
import settingState from '@/store/setting/state'

export interface DownloadQualityModalType {
  /** 弹音质选择并入队下载；defaultQuality 缺省=下载设置档 */
  show: (musicInfo: SY.Music.MusicInfoOnline, defaultQuality?: SY.Quality) => void
}

// 下载音质选择弹层（2026-10-29 走查反馈拍板：下载入口统一弹窗选档，设置档=默认预选；
// 播放页入口默认传当前播放档——「下正在听的这版」）。档位=该歌 _qualitys ∩ /config 下发档，
// 不展示下不了的档；无可用档 toast 不弹壳。对标 QQ 音乐/网易云单曲下载选档交互。
export default forwardRef<DownloadQualityModalType>((_, ref) => {
  const t = useI18n()
  const sheetRef = useRef<CheckSheetType>(null)
  const [visible, setVisible] = useState(false)
  const [options, setOptions] = useState<readonly CheckSheetItem[]>([])
  const [value, setValue] = useState<SY.Quality>('128k')
  const infoRef = useRef<SY.Music.MusicInfoOnline | null>(null)

  useImperativeHandle(ref, () => ({
    show(musicInfo, defaultQuality) {
      // 换源盲区修复（2026-11-02）：换源产物挂 meta.toggleMusicInfo、列表身份稳定是基座设计——
      // 摘源后原源不在 qualityList（如 kw），按条目源算交集恒空误报「无可用音质」（实际在播
      // 链路完好）。下载语义=「下正在听的这版」：交集/入队/已下载标记统一按实际在播条目取数。
      const actualInfo = musicInfo.meta.toggleMusicInfo ?? musicInfo
      const available = PLAY_QUALITY_LIST.filter(q => actualInfo.meta._qualitys[q] && global.sy.qualityList[actualInfo.source]?.includes(q))
      if (!available.length) {
        toast(global.i18n.t('download_no_available_quality'))
        return
      }
      infoRef.current = actualInfo
      const fallback = defaultQuality ?? settingState.setting['download.quality']
      // 默认档不在可用集（如账号/源差异）时落到最高可用档
      const selected = available.includes(fallback) ? fallback : available[0]
      setValue(selected)
      // 已下载档标记（2026-10-29 题1 拍板2，单源 getDownloadedQuality）：点它 toast 已存在，选未下载档=换档重下
      const downloadedQuality = downloadedAction.getDownloadedQuality(actualInfo.source, actualInfo.id)
      setOptions(available.map(q => ({
        action: q,
        label: qualityLabelMarked(q, downloadedQuality, t),
      })))
      setVisible(true)
      requestAnimationFrame(() => {
        sheetRef.current?.show()
      })
    },
  }), [t])

  const handlePress = (item: CheckSheetItem) => {
    setVisible(false)
    const musicInfo = infoRef.current
    if (!musicInfo) return
    // 存储权限前置引导（2026-11-02）：无权限任务会以 error 态入队而 toast 仍报「已添加」（误导，
    // 用户要到失败列表才见「无存储权限」）——当场拦截+跳「所有文件访问」开关页（本地音乐页
    // 同款分级兜底）；API<30 由 ensureStoragePermission 直接弹运行时请求
    void ensureStoragePermission().then(granted => {
      if (!granted) {
        toast(global.i18n.t('download_no_storage_permission'), 'long')
        const open = NativeModules.DownloadSupport?.openAllFilesAccessSettings?.()
        void (open ?? Promise.reject(new Error('DownloadSupport unavailable'))).catch(async() => {
          toast(global.i18n.t('storage_permission_manual_guide'), 'long')
          return Linking.openSettings().catch(() => {})
        })
        return
      }
      // 三态 toast（2026-10-29 ①-3 定稿）：downloaded 带实际落地档（回退链下请求档≠落地档，
      // 审查 I-F），对标 Apple Music 显示实际已下载版本；error=权益闸门拦截（⑧ 引导已弹，静默）
      void addDownloadTask(musicInfo, item.action as SY.Quality).then(({ status, downloadedQuality }) => {
        if (status == 'error') return
        if (status == 'downloaded') {
          toast(global.i18n.t('download_done', { quality: qualityLabel(downloadedQuality ?? '128k', t) }))
        } else {
          toast(global.i18n.t(status == 'exists' ? 'download_exists' : 'download_added'))
        }
      })
    })
  }

  return (
    visible
      ? (
          <CheckSheet
            ref={sheetRef}
            title={`${t('download_action')} · ${t('quality')}`}
            options={options}
            value={value}
            onPress={handlePress}
            onHide={() => { setVisible(false) }}
          />
        )
      : null
  )
})
