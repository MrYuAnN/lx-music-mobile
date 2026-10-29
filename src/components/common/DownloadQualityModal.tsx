import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import { useI18n } from '@/lang'
import { PLAY_QUALITY_LIST } from '@/core/music/utils'
import { qualityLabel, qualityLabelMarked } from '@/utils/music'
import { addDownloadTask } from '@/core/download'
import { action as downloadedAction } from '@/store/downloaded'
import { toast } from '@/utils/tools'
import settingState from '@/store/setting/state'

export interface DownloadQualityModalType {
  /** 弹音质选择并入队下载；defaultQuality 缺省=下载设置档 */
  show: (musicInfo: LX.Music.MusicInfoOnline, defaultQuality?: LX.Quality) => void
}

// 下载音质选择弹层（2026-10-29 走查反馈拍板：下载入口统一弹窗选档，设置档=默认预选；
// 播放页入口默认传当前播放档——「下正在听的这版」）。档位=该歌 _qualitys ∩ /config 下发档，
// 不展示下不了的档；无可用档 toast 不弹壳。对标 QQ 音乐/网易云单曲下载选档交互。
export default forwardRef<DownloadQualityModalType>((_, ref) => {
  const t = useI18n()
  const sheetRef = useRef<CheckSheetType>(null)
  const [visible, setVisible] = useState(false)
  const [options, setOptions] = useState<readonly CheckSheetItem[]>([])
  const [value, setValue] = useState<LX.Quality>('128k')
  const infoRef = useRef<LX.Music.MusicInfoOnline | null>(null)

  useImperativeHandle(ref, () => ({
    show(musicInfo, defaultQuality) {
      const available = PLAY_QUALITY_LIST.filter(q => musicInfo.meta._qualitys[q] && global.lx.qualityList[musicInfo.source]?.includes(q))
      if (!available.length) {
        toast(global.i18n.t('download_no_available_quality'))
        return
      }
      infoRef.current = musicInfo
      const fallback = defaultQuality ?? settingState.setting['download.quality']
      // 默认档不在可用集（如账号/源差异）时落到最高可用档
      const selected = available.includes(fallback) ? fallback : available[0]
      setValue(selected)
      // 已下载档标记（2026-10-29 题1 拍板2，单源 getDownloadedQuality）：点它 toast 已存在，选未下载档=换档重下
      const downloadedQuality = downloadedAction.getDownloadedQuality(musicInfo.source, musicInfo.id)
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
    // 三态 toast（2026-10-29 ①-3 定稿）：downloaded 带实际落地档（回退链下请求档≠落地档，
    // 审查 I-F），对标 Apple Music 显示实际已下载版本
    void addDownloadTask(musicInfo, item.action as LX.Quality).then(({ status, downloadedQuality }) => {
      if (status == 'downloaded') {
        toast(global.i18n.t('download_done', { quality: qualityLabel(downloadedQuality ?? '128k', t) }))
      } else {
        toast(global.i18n.t(status == 'exists' ? 'download_exists' : 'download_added'))
      }
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
