import type { Track as RNTrack } from 'react-native-track-player'
import type { PLAY_CHANNEL } from '@/config/constant'

declare global {
  namespace SY {
    namespace Player {
      interface MusicInfo {
        id: string | null
        pic: string | null | undefined
        lrc: string | null
        tlrc: string | null
        rlrc: string | null
        lxlrc: string | null
        rawlrc: string | null
        // url: string | null
        name: string
        singer: string
        album: string
      }

      interface LyricInfo extends SY.Music.LyricInfo {
        rawlrcInfo: SY.Music.LyricInfo
      }

      type PlayMusic = SY.Music.MusicInfo | SY.Download.ListItem

      type PlayMusicInfo = Readonly<{
        /**
         * 当前播放歌曲的列表 id
         */
        musicInfo: PlayMusic
        /**
          * 当前播放歌曲的列表 id
          */
        listId: string
        /**
          * 是否属于 “稍后播放”
          */
        isTempPlay: boolean
        /**
         * 播放发起渠道（使用统计 play_source 单源，值域=PLAY_CHANNELS）：
         * search/leaderboard/songlist/download/local/recent/preview/deeplink 等。
         * 打标入口见各屏播放调用；缺省（我的列表/播放队列/恢复播放等）由统计侧
         * 按 listId 反推兜底
         */
        channel?: PLAY_CHANNEL | ''
      }>

      interface PlayInfo {
        /**
         * 当前正在播放歌曲 index
         */
        playIndex: number
        /**
        * 播放器的播放列表 id
        */
        playerListId: string | null
        /**
        * 播放器播放歌曲 index
        */
        playerPlayIndex: number
      }

      interface TempPlayListItem {
        /**
         * 播放列表id
         */
        listId: string | null
        /**
         * 歌曲信息
         */
        musicInfo: PlayMusic
        /**
         * 是否添加到列表顶部
         */
        isTop?: boolean
        /**
         * 播放发起渠道（使用统计 play_source 单源，值域=PLAY_CHANNELS）：稍后播放
         * 插播时经 handlePlayNext 透传；缺省由统计侧按 listId 反推兜底
         */
        channel?: PLAY_CHANNEL | ''
      }

      interface SavedPlayInfo {
        time: number
        maxTime: number
        listId: string
        index: number
        /** 当前播放歌曲 id（2026-10-30 审查 I-1：TEMP 列表可被新搜索覆盖，恢复时按 id 重定位防错歌错进度；旧存档无此字段走位置语义） */
        musicId?: string
        /** 播放发起渠道（2026-11-05 渠道区分批审查 S-5：重启恢复延续原会话渠道；旧存档无此字段走 listId 反推兜底） */
        channel?: PLAY_CHANNEL | ''
      }

      interface Track extends RNTrack {
        musicId: string
        // original: PlayMusic
        // quality: SY.Quality
      }

    }
  }
}
