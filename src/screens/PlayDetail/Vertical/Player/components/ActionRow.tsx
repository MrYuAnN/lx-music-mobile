import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import DotsVertical from '@/components/common/DotsVertical'
import Text from '@/components/common/Text'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import DesktopLyricEnable, { type DesktopLyricEnableType } from '@/components/DesktopLyricEnable'
import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import SheetBase, { type SheetBaseType } from '@/components/common/SheetBase'
import SettingPopup, { type SettingPopupType } from '../../../components/SettingPopup'
import SettingLrcFontSize from '../../../components/SettingPopup/settings/SettingLrcFontSize'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import playerState from '@/store/player/state'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { updateSetting } from '@/core/common'
import { toggleTranslation } from '@/core/lyric'
import { lockDesktopLyric, unlockDesktopLyric } from '@/core/desktopLyric'
import { reloadCurrentWithQuality } from '@/core/player/player'
import DownloadQualityModal, { type DownloadQualityModalType } from '@/components/common/DownloadQualityModal'
import { createStyle } from '@/utils/tools'
import { PLAY_QUALITY_LIST } from '@/core/music/utils'
import { qualityLabel, qualityLabelMarked, toOnlineIdentity } from '@/utils/music'
import { useLrcHasTranslation } from '@/plugins/lyric'
import { usePlayMusicInfo, useActualQuality } from '@/store/player/hook'
import { useDownloadedSet, action as downloadedAction } from '@/store/downloaded'
import { getDownloadListSnapshot } from '@/core/download'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import settingState from '@/store/setting/state'

// AM 播放页动作行（方案 §问题7，参考图1/图2）：图标+文字标签、随歌词/封面页切换两组。
// 封面页：收藏/评论/音质/更多；歌词页：字体大小/翻译/悬浮歌词/更多。
export interface ActionRowProps {
  /** PagerView 页码：0 封面 / 1 歌词 */
  page: number
}

interface ActionItem {
  id: string
  icon: string
  label: string
  onPress: () => void
  onLongPress?: () => void
  disabled?: boolean
}

const getOnlineMusicInfo = () => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}

const ActionRow = ({ page }: ActionRowProps) => {
  const theme = useTheme()
  const t = useI18n()
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const downloadQualityModalRef = useRef<DownloadQualityModalType>(null)
  const desktopLyricRef = useRef<DesktopLyricEnableType>(null)
  const settingPopupRef = useRef<SettingPopupType>(null)
  const qualitySheetRef = useRef<CheckSheetType>(null)
  const fontSizeSheetRef = useRef<SheetBaseType>(null)
  const [qualitySheetVisible, setQualitySheetVisible] = useState(false)
  const [fontSizeSheetVisible, setFontSizeSheetVisible] = useState(false)

  const playQuality = useSettingValue('player.playQuality')
  const isShowTranslation = useSettingValue('player.isShowLyricTranslation')
  const enabledLyric = useSettingValue('desktopLyric.enable')
  const hasTranslation = useLrcHasTranslation()
  // 响应式当前歌：换歌/切源后音质可用性随其刷新（审查 C2 修复，勿直读 playerState）
  const playMusicInfo = usePlayMusicInfo()
  // 实际播放档（题1 拍板4：本地命中=下载档、在线=落地档；null 回退全局设置档）
  const actualQuality = useActualQuality()
  const downloadedSet = useDownloadedSet()

  // 当前歌在线身份（题1 拍板1 单源归一）：下载槽三态/音质面板取数全经此，禁用 meta.songId
  const identityMusicInfo = useMemo(() => {
    const cur = playMusicInfo.musicInfo
    if (!cur) return null
    return toOnlineIdentity('progress' in cur ? cur.metadata.musicInfo : cur)
  }, [playMusicInfo])
  const identityIsBareLocal = identityMusicInfo?.source == 'local'

  // 在途下载任务态（判定单源=snapshot 派生，仅筛当前曲 taskId 防 2Hz 整表重渲——审查 S-3）
  const taskId = identityMusicInfo && !identityIsBareLocal
    ? `download__${identityMusicInfo.source}__${identityMusicInfo.id}`
    : null
  const [taskState, setTaskState] = useState<{ status: SY.Download.DownloadTaskStatus, progress: number } | null>(null)
  useEffect(() => {
    const refresh = () => {
      if (!taskId) {
        setTaskState(null)
        return
      }
      const task = getDownloadListSnapshot().find(t => t.id == taskId)
      // 判等防无效重渲（审查 S-2）：downloadProgress 500ms 节流推送，无进度变化态（waiting/pause）
      // 不因新对象引用触发 2Hz 重渲
      setTaskState(prev => {
        const next = task && task.status != 'completed' ? { status: task.status, progress: task.progress } : null
        return prev != null && next != null && prev.status == next.status && prev.progress == next.progress ? prev : next
      })
    }
    refresh()
    global.state_event.on('downloadStateChanged', refresh)
    global.state_event.on('downloadProgress', refresh)
    return () => {
      global.state_event.off('downloadStateChanged', refresh)
      global.state_event.off('downloadProgress', refresh)
    }
  }, [taskId])

  const showMusicAddModal = useCallback(() => {
    const musicInfo = getOnlineMusicInfo()
    if (!musicInfo) return
    musicAddModalRef.current?.show({
      musicInfo,
      isMove: false,
      listId: playerState.playMusicInfo.listId!,
    })
  }, [])

  const showCommentScreen = useCallback(() => {
    navigations.pushCommentScreen(commonState.componentIds.playDetail!)
  }, [])

  const toggleDesktopLyric = useCallback(() => {
    desktopLyricRef.current?.setEnabled(!enabledLyric)
  }, [enabledLyric])

  const toggleDesktopLyricLock = useCallback(() => {
    // 锁定走含通知权限请求的主链路（审查 I4）；解锁直达
    const isLock = !settingState.setting['desktopLyric.isLock']
    void (isLock ? lockDesktopLyric() : unlockDesktopLyric()).catch(() => {})
  }, [])

  const showQualitySheet = useCallback(() => {
    setQualitySheetVisible(true)
    requestAnimationFrame(() => {
      qualitySheetRef.current?.show()
    })
  }, [])

  const qualityOptions = useMemo<readonly CheckSheetItem[]>(() => {
    // 已下载曲按原曲在线身份展示可切档位（toOnlineIdentity 单源归一），切档经 reloadCurrentWithQuality 在线重链
    // （无业界对标，本产品自定：免重下载在线试听新档，审查 I-3）
    const musicInfo = identityMusicInfo
    const sourceQualityList = musicInfo ? global.sy.qualityList[musicInfo.source] : undefined
    // 本地歌曲等无在线音质元数据的场景：选项集为空 → 音质入口置灰（缺失能力不上界面，拍板原则）
    const songQualitys = musicInfo
      ? (musicInfo.meta as SY.Music.MusicInfoMeta_online)._qualitys
      : undefined
    // 已下载档标记（题1 拍板3，对标 QQ 音乐音质面板）
    const downloadedQuality = musicInfo && !identityIsBareLocal
      ? downloadedAction.getDownloadedQuality(musicInfo.source, musicInfo.id)
      : undefined
    return PLAY_QUALITY_LIST
      .filter(q => sourceQualityList?.includes(q))
      .map(q => ({
        action: q,
        label: qualityLabelMarked(q, downloadedQuality, t),
        disabled: !songQualitys?.[q],
      }))
  }, [identityMusicInfo, identityIsBareLocal, t])
  const hasQualityOptions = qualityOptions.length > 0

  const handleQualityChange = useCallback((item: CheckSheetItem) => {
    if (item.action == playQuality) return
    updateSetting({ 'player.playQuality': item.action as typeof playQuality })
    // 当前歌按新档重取链续播（恢复进度、失败不打断、暂停态保持暂停；可能触发换源）
    reloadCurrentWithQuality()
  }, [playQuality])

  const showFontSizeSheet = useCallback(() => {
    setFontSizeSheetVisible(true)
    requestAnimationFrame(() => {
      fontSizeSheetRef.current?.setVisible(true)
    })
  }, [])

  const showSettingPopup = useCallback(() => {
    settingPopupRef.current?.show()
  }, [])

  const handleToggleTranslation = useCallback(() => {
    updateSetting({ 'player.isShowLyricTranslation': !isShowTranslation })
    void toggleTranslation(!isShowTranslation)
  }, [isShowTranslation])

  // 下载当前播放歌（2026-10-29 走查反馈：播放页原无下载入口，拍板封面页动作组增第五槽，
  // 一级直达对标 QQ 音乐播放页；复用列表菜单同一下载链 addDownloadTask）
  const openDownloadManager = useCallback(() => {
    const componentId = commonState.componentIds.playDetail
    if (componentId) navigations.pushDownloadScreen(componentId)
  }, [])

  // 下载槽多态（2026-10-29 题1 拍板2）：未下载弹选档 / 下载中·xx% 跳管理（无业界对标，本产品
  // 自定：点击=跳转队列全景，防误触中断下载）/ 等待 Wi-Fi·已暂停·失败跳管理 / 已下载（点击
  // 仍弹选档：标已下载档，点它 toast，选未下载档=换档重下旧档删除）。
  // 裸本地曲（无在线身份）置灰：无下载能力（缺失能力不上界面）
  const downloadSlot = useMemo(() => {
    const showQualityModal = () => {
      if (!identityMusicInfo || identityIsBareLocal) return
      // 弹音质选择，默认选中当前播放档（actualQuality 即实际在播档）
      downloadQualityModalRef.current?.show(identityMusicInfo, actualQuality ?? settingState.setting['player.playQuality'])
    }
    if (!identityMusicInfo || identityIsBareLocal) {
      return { icon: 'download-2', label: t('download_action'), disabled: true, onPress: () => {} }
    }
    if (taskState) {
      const label = taskState.status == 'run'
        ? `${t('download_status_downloading')} · ${taskState.progress}%`
        : taskState.status == 'pause'
          ? t('download_paused')
          : taskState.status == 'waiting'
            ? t('download_waiting_wifi')
            : t('download_failed')
      return { icon: 'download-2', label, disabled: false, onPress: openDownloadManager }
    }
    if (downloadedSet.has(downloadedAction.getDownloadedKey(identityMusicInfo.source, identityMusicInfo.id))) {
      return { icon: 'check-circle', label: t('download_mark_downloaded'), disabled: false, onPress: showQualityModal }
    }
    return { icon: 'download-2', label: t('download_action'), disabled: false, onPress: showQualityModal }
  }, [identityMusicInfo, identityIsBareLocal, taskState, downloadedSet, actualQuality, t, openDownloadManager])

  // 封面页动作组（参考图1：收藏/评论/下载/音质/更多）
  const coverActions = useMemo<ActionItem[]>(() => {
    return [
      { id: 'collect', icon: 'heart-outline', label: t('collect'), onPress: showMusicAddModal },
      { id: 'comment', icon: 'comment', label: t('comment'), onPress: showCommentScreen },
      { id: 'download', icon: downloadSlot.icon, label: downloadSlot.label, onPress: downloadSlot.onPress, disabled: downloadSlot.disabled },
      // 无可消费档位（本地歌等）置灰 + 中性文案，不弹空壳（缺失能力不上界面）；
      // label 显实际播放档（拍板4：本地命中=下载档、在线=落地档，回退全局设置档）
      { id: 'quality', icon: 'album', label: hasQualityOptions ? qualityLabel(actualQuality ?? playQuality, t) : t('quality'), onPress: showQualitySheet, disabled: !hasQualityOptions },
      { id: 'more', icon: 'more', label: t('more_action'), onPress: showSettingPopup },
    ]
  }, [t, actualQuality, playQuality, hasQualityOptions, showMusicAddModal, showCommentScreen, downloadSlot, showQualitySheet, showSettingPopup])

  // 歌词页动作组（参考图2：字体大小/翻译/悬浮歌词/更多）
  const lyricActions = useMemo<ActionItem[]>(() => {
    return [
      { id: 'font_size', icon: 'font-size', label: t('font_size'), onPress: showFontSizeSheet },
      { id: 'translation', icon: isShowTranslation ? 'translate-on' : 'translate-off', label: t('translation'), onPress: handleToggleTranslation, disabled: !hasTranslation },
      { id: 'desktop_lyric', icon: enabledLyric ? 'lyric-on' : 'lyric-off', label: t('desktop_lyric'), onPress: toggleDesktopLyric, onLongPress: toggleDesktopLyricLock },
      { id: 'more', icon: 'more', label: t('more_action'), onPress: showSettingPopup },
    ]
  }, [t, hasTranslation, enabledLyric, isShowTranslation, showFontSizeSheet, handleToggleTranslation, toggleDesktopLyric, toggleDesktopLyricLock, showSettingPopup])

  const actions = page == 1 ? lyricActions : coverActions

  return (
    <View style={styles.container}>
      {
        actions.map(action => (
          <TouchableOpacity
            key={action.id}
            style={styles.item}
            activeOpacity={0.6}
            disabled={action.disabled}
            onPress={action.onPress}
            onLongPress={action.onLongPress}
          >
            {
              // 「更多」用 DotsVertical 组件（Icon 三点字形为横向，项目约定恒竖向；业界 AM/Spotify 同为 ellipsis 唤起菜单）。
              // size=动作图标半高（真机反馈 2026-10-20：默认 14dp 实心点与 24dp 线性图标同框显粗大——
              // 缩至 12dp 槽内点径 2.6dp，视觉密度对齐线性图标线宽）
              action.id === 'more'
                ? <View style={styles.moreIconSlot}><DotsVertical size={ICON_SIZE_ACTION * 0.5} color={action.disabled ? theme['c-font-label'] : theme['c-font']} /></View>
                : <Icon name={action.icon} size={ICON_SIZE_ACTION} color={action.disabled ? theme['c-font-label'] : theme['c-font']} />
            }
            <Text style={styles.label} size={11} numberOfLines={1} color={theme['c-font-label']}>{action.label}</Text>
          </TouchableOpacity>
        ))
      }
      <MusicAddModal ref={musicAddModalRef} />
      <DownloadQualityModal ref={downloadQualityModalRef} />
      <DesktopLyricEnable ref={desktopLyricRef} />
      {
        qualitySheetVisible
          ? (
              <CheckSheet
                ref={qualitySheetRef}
                title={t('quality')}
                options={qualityOptions}
                value={playQuality}
                onPress={handleQualityChange}
                onHide={() => { setQualitySheetVisible(false) }}
              />
            )
          : null
      }
      {
        fontSizeSheetVisible
          ? (
              <SheetBase ref={fontSizeSheetRef} title={t('font_size')} onHide={() => { setFontSizeSheetVisible(false) }}>
                <SettingLrcFontSize direction="vertical" />
              </SheetBase>
            )
          : null
      }
      <SettingPopup ref={settingPopupRef} direction="vertical" />
    </View>
  )
}

// 音质档位文案单源 utils/music qualityLabel（2026-10-12 审查收口，原本地副本退役）

const ICON_SIZE_ACTION = scaleSizeW(24)

const styles = createStyle({
  moreIconSlot: {
    width: ICON_SIZE_ACTION,
    height: ICON_SIZE_ACTION,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'space-around',
    paddingTop: scaleSizeH(4),
    paddingBottom: scaleSizeH(8),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: scaleSizeH(5),
    paddingTop: scaleSizeH(6),
    paddingBottom: scaleSizeH(4),
  },
  label: {
    maxWidth: '100%',
  },
})

export default memo(ActionRow)
