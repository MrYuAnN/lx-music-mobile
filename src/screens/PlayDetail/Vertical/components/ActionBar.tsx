import { memo, useRef } from 'react'
import { View } from 'react-native'

import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import DesktopLyricEnable, { type DesktopLyricEnableType } from '@/components/DesktopLyricEnable'
import playerState from '@/store/player/state'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { toggleDesktopLyricLock } from '@/core/desktopLyric'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import ToolBtn from './ToolBtn'

// 操作行（封面页专属）：收藏 / 评论 / 桌面歌词 / 定时 / 更多（音量、倍速）

const FavBtn = () => {
  const t = useI18n()
  const musicAddModalRef = useRef<MusicAddModalType>(null)

  const handleShowMusicAddModal = () => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    const listId = playerState.playMusicInfo.listId
    if (!musicInfo || !listId) return
    musicAddModalRef.current?.show({
      musicInfo: 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo,
      isMove: false,
      listId,
    })
  }

  return (
    <>
      <ToolBtn icon="add-music" label={t('collect')} onPress={handleShowMusicAddModal} />
      <MusicAddModal ref={musicAddModalRef} />
    </>
  )
}

const CommentBtn = () => {
  const t = useI18n()

  const handleShowCommentScreen = () => {
    navigations.pushCommentScreen(commonState.componentIds.playDetail!)
  }

  return <ToolBtn icon="comment" label={t('play_detail_action_comment')} onPress={handleShowCommentScreen} />
}

// 桌面歌词键（操作行与歌词工具行共用）
export const DesktopLyricBtn = () => {
  const t = useI18n()
  const enabledLyric = useSettingValue('desktopLyric.enable')
  const desktopLyricEnableRef = useRef<DesktopLyricEnableType>(null)
  const update = () => {
    desktopLyricEnableRef.current?.setEnabled(!enabledLyric)
  }
  const updateLock = () => {
    const isLock = !settingState.setting['desktopLyric.isLock']
    void toggleDesktopLyricLock(isLock).then(() => {
      updateSetting({ 'desktopLyric.isLock': isLock })
    })
  }

  return (
    <>
      <ToolBtn icon={enabledLyric ? 'lyric-on' : 'lyric-off'} label={t('play_detail_action_desktop_lyric')} onPress={update} onLongPress={updateLock} />
      <DesktopLyricEnable ref={desktopLyricEnableRef} />
    </>
  )
}

const TimeoutBtn = () => {
  const t = useI18n()
  const modalRef = useRef<TimeoutExitEditModalType>(null)
  const timeInfo = useTimeInfo()

  const handleShow = () => {
    modalRef.current?.show()
  }

  return (
    <>
      <ToolBtn icon="music_time" label={t('play_detail_action_timeout')} active={timeInfo.active} onPress={handleShow} />
      <TimeoutExitEditModal ref={modalRef} timeInfo={timeInfo} />
    </>
  )
}

const MoreBtn = () => {
  const t = useI18n()
  const popupRef = useRef<SettingPopupType>(null)

  const handleShow = () => {
    popupRef.current?.show()
  }

  return (
    <>
      <ToolBtn icon="dots-vertical" label={t('play_detail_action_more')} onPress={handleShow} />
      <SettingPopup ref={popupRef} direction="vertical" items={['volume', 'rate']} />
    </>
  )
}

export default memo(() => {
  return (
    <View style={styles.container}>
      <FavBtn />
      <CommentBtn />
      <DesktopLyricBtn />
      <TimeoutBtn />
      <MoreBtn />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
})
