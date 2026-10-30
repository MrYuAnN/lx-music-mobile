import { init as initLyricPlayer, toggleTranslation, toggleRoma, play, pause, stop, setLyric, setPlaybackRate } from '@/core/lyric'
import { updateSetting } from '@/core/common'
import { initDesktopLyricListener, onDesktopLyricPositionChange, setDesktopLyricPlayState, showDesktopLyric, onLyricLinePlay, showRemoteLyric } from '@/core/desktopLyric'
import playerState from '@/store/player/state'
import { updateNowPlayingTitles } from '@/plugins/player/utils'
import { setLastLyric } from '@/core/player/playInfo'

const updateRemoteLyric = async(lrc?: string) => {
  setLastLyric(lrc)
  if (lrc == null) {
    void updateNowPlayingTitles({
      title: playerState.musicInfo.name,
      artist: playerState.musicInfo.singer ?? '',
      album: playerState.musicInfo.album ?? '',
    })
  } else {
    void updateNowPlayingTitles({
      title: lrc,
      artist: `${playerState.musicInfo.name}${playerState.musicInfo.singer ? ` - ${playerState.musicInfo.singer}` : ''}`,
      album: playerState.musicInfo.album ?? '',
    })
  }
}

export default async(setting: SY.AppSetting) => {
  await initLyricPlayer()
  await Promise.all([
    setPlaybackRate(setting['player.playbackRate']),
    toggleTranslation(setting['player.isShowLyricTranslation']),
    toggleRoma(setting['player.isShowLyricRoma']),
  ])

  if (setting['desktopLyric.enable']) {
    showDesktopLyric().catch(() => {
      updateSetting({ 'desktopLyric.enable': false })
    })
  }
  if (setting['player.isShowBluetoothLyric']) {
    showRemoteLyric(true).catch(() => {
      updateSetting({ 'player.isShowBluetoothLyric': false })
    })
  }
  onDesktopLyricPositionChange(position => {
    updateSetting({
      'desktopLyric.position.x': position.x,
      'desktopLyric.position.y': position.y,
    })
  })
  onLyricLinePlay(({ text, extendedLyrics }) => {
    if (!text && !playerState.isPlay) {
      void updateRemoteLyric()
    } else {
      void updateRemoteLyric(text)
    }
  })

  // 悬浮歌词事件接线（工具条动作/通知解锁回写/前后台隐身 D7）
  initDesktopLyricListener()

  // 播放态同步悬浮歌词工具条播放/暂停图标
  global.app_event.on('play', () => {
    play()
    void setDesktopLyricPlayState(true)
  })
  global.app_event.on('pause', () => {
    pause()
    void setDesktopLyricPlayState(false)
  })
  global.app_event.on('stop', () => {
    stop()
    void setDesktopLyricPlayState(false)
  })
  global.app_event.on('error', () => {
    pause()
    void setDesktopLyricPlayState(false)
  })
  global.app_event.on('musicToggled', () => {
    stop()
    void setDesktopLyricPlayState(false)
  })
  global.app_event.on('lyricUpdated', setLyric)
}
