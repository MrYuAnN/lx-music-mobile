import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
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
import { toggleDesktopLyricLock as lrcToggleDesktopLyricLock } from '@/core/desktopLyric'
import { setMusicUrl } from '@/core/player/player'
import { PLAY_QUALITY_LIST } from '@/core/music/utils'
import { useLrcHasTranslation } from '@/plugins/lyric'
import { usePlayMusicInfo } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
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
    const isLock = !settingState.setting['desktopLyric.isLock']
    void lrcToggleDesktopLyricLock(isLock).then(() => {
      updateSetting({ 'desktopLyric.isLock': isLock })
    }).catch(() => {})
  }, [])

  const showQualitySheet = useCallback(() => {
    setQualitySheetVisible(true)
    requestAnimationFrame(() => {
      qualitySheetRef.current?.show()
    })
  }, [])

  const qualityOptions = useMemo<Readonly<CheckSheetItem[]>>(() => {
    const musicInfo = playMusicInfo.musicInfo
      ? ('progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo)
      : null
    const sourceQualityList = musicInfo ? global.lx.qualityList[musicInfo.source] : undefined
    // 本地歌曲等无在线音质元数据的场景：选项集为空 → 音质入口置灰（缺失能力不上界面，拍板原则）
    const songQualitys = musicInfo
      ? (musicInfo.meta as LX.Music.MusicInfoMeta_online)._qualitys
      : undefined
    return PLAY_QUALITY_LIST
      .filter(q => sourceQualityList?.includes(q))
      .map(q => ({
        action: q,
        label: qualityLabel(q, t),
        disabled: !songQualitys?.[q],
      }))
  }, [playMusicInfo, t])
  const hasQualityOptions = qualityOptions.length > 0

  const handleQualityChange = useCallback((item: CheckSheetItem) => {
    if (item.action == playQuality) return
    updateSetting({ 'player.playQuality': item.action as typeof playQuality })
    // 当前歌重取链续播（换音质即时生效，可能触发换源）
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (musicInfo) setMusicUrl(musicInfo, true)
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

  // 封面页动作组（参考图1：收藏/评论/音质/更多）
  const coverActions = useMemo<ActionItem[]>(() => {
    return [
      { id: 'collect', icon: 'heart-outline', label: t('collect'), onPress: showMusicAddModal },
      { id: 'comment', icon: 'comment', label: t('comment'), onPress: showCommentScreen },
      // 无可消费档位（本地歌等）置灰 + 中性文案，不弹空壳（缺失能力不上界面）
      { id: 'quality', icon: 'album', label: hasQualityOptions ? qualityLabel(playQuality, t) : t('quality'), onPress: showQualitySheet, disabled: !hasQualityOptions },
      { id: 'more', icon: 'dots-vertical', label: t('more_action'), onPress: showSettingPopup },
    ]
  }, [t, playQuality, hasQualityOptions, showMusicAddModal, showCommentScreen, showQualitySheet, showSettingPopup])

  // 歌词页动作组（参考图2：字体大小/翻译/悬浮歌词/更多）
  const lyricActions = useMemo<ActionItem[]>(() => {
    return [
      { id: 'font_size', icon: 'edit-metadata', label: t('font_size'), onPress: showFontSizeSheet },
      { id: 'translation', icon: 'toggle-source', label: t('translation'), onPress: handleToggleTranslation, disabled: !hasTranslation },
      { id: 'desktop_lyric', icon: enabledLyric ? 'lyric-on' : 'lyric-off', label: t('desktop_lyric'), onPress: toggleDesktopLyric, onLongPress: toggleDesktopLyricLock },
      { id: 'more', icon: 'dots-vertical', label: t('more_action'), onPress: showSettingPopup },
    ]
  }, [t, hasTranslation, enabledLyric, showFontSizeSheet, handleToggleTranslation, toggleDesktopLyric, toggleDesktopLyricLock, showSettingPopup])

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
            <Icon
              name={action.icon}
              size={ICON_SIZE_ACTION}
              color={action.disabled ? theme['c-font-label'] : theme['c-font']}
            />
            <Text style={styles.label} size={11} numberOfLines={1} color={theme['c-font-label']}>{action.label}</Text>
          </TouchableOpacity>
        ))
      }
      <MusicAddModal ref={musicAddModalRef} />
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

// 音质档位文案：128k=标准（补键），HQ/SQ/24bit 复用既有键，其余档位裸露码率（不进选项集，仅标签兜底）
const qualityLabel = (quality: LX.Quality, t: ReturnType<typeof useI18n>) => {
  switch (quality) {
    case '128k':
      return t('quality_128k')
    case '320k':
      return t('quality_high_quality')
    case 'flac':
      return t('quality_lossless')
    case 'flac24bit':
      return t('quality_lossless_24bit')
    default:
      return quality
  }
}

const ICON_SIZE_ACTION = scaleSizeW(24)

const styles = createStyle({
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
