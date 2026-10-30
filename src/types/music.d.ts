declare namespace SY {
  namespace Music {
    interface MusicQualityType { // {"type": "128k", size: "3.56M"}
      type: SY.Quality
      size: string | null
    }
    interface MusicQualityTypeKg { // {"type": "128k", size: "3.56M"}
      type: SY.Quality
      size: string | null
      hash: string
    }
    type _MusicQualityType = Partial<Record<Quality, {
      size: string | null
    }>>
    type _MusicQualityTypeKg = Partial<Record<Quality, {
      size: string | null
      hash: string
    }>>


    interface MusicInfoMetaBase {
      songId: string | number // 歌曲ID，mg源为copyrightId，local为文件路径
      albumName: string // 歌曲专辑名称
      picUrl?: string | null // 歌曲图片链接
      toggleMusicInfo?: MusicInfoOnline | null
    }

    interface MusicInfoMeta_online extends MusicInfoMetaBase {
      qualitys: MusicQualityType[]
      _qualitys: _MusicQualityType
      albumId?: string | number // 歌曲专辑ID
    }

    interface MusicInfoMeta_local extends MusicInfoMetaBase {
      filePath: string
      ext: string
      onlineInfo?: MusicInfoOnline // 下载曲的原曲在线身份（评论/切档取链用，扫描本地曲无此字段）
      _qualitys?: _MusicQualityType // 下载曲回填的实际档（本地页音质标签，2026-10-29 走查反馈）
      noCover?: boolean // 匹配失败负缓存（无可用封面，置位后跳过封面匹配）
    }


    interface MusicInfoBase<S = SY.Source> {
      id: string
      name: string // 歌曲名
      singer: string // 艺术家名
      source: S // 源
      interval: string | null // 格式化后的歌曲时长，例：03:55
      meta: MusicInfoMetaBase
    }

    interface MusicInfoLocal extends MusicInfoBase<'local'> {
      meta: MusicInfoMeta_local
    }

    interface MusicInfo_online_common extends MusicInfoBase<'kw' | 'wy'> {
      meta: MusicInfoMeta_online
    }

    interface MusicInfoMeta_kg extends MusicInfoMeta_online {
      qualitys: MusicQualityTypeKg[]
      _qualitys: _MusicQualityTypeKg
      hash: string // 歌曲hash
    }
    interface MusicInfo_kg extends MusicInfoBase<'kg'> {
      meta: MusicInfoMeta_kg
    }

    interface MusicInfoMeta_tx extends MusicInfoMeta_online {
      strMediaMid: string // 歌曲strMediaMid
      id?: number // 歌曲songId
      albumMid?: string // 歌曲albumMid
    }
    interface MusicInfo_tx extends MusicInfoBase<'tx'> {
      meta: MusicInfoMeta_tx
    }

    interface MusicInfoMeta_mg extends MusicInfoMeta_online {
      copyrightId: string // 歌曲copyrightId
      lrcUrl?: string // 歌曲lrcUrl
      mrcUrl?: string // 歌曲mrcUrl
      trcUrl?: string // 歌曲trcUrl
    }
    interface MusicInfo_mg extends MusicInfoBase<'mg'> {
      meta: MusicInfoMeta_mg
    }

    type MusicInfoOnline = MusicInfo_online_common | MusicInfo_kg | MusicInfo_tx | MusicInfo_mg
    type MusicInfo = MusicInfoOnline | MusicInfoLocal

    interface LyricInfo {
      // 歌曲歌词
      lyric: string
      // 翻译歌词
      tlyric?: string | null
      // 罗马音歌词
      rlyric?: string | null
      // 逐字歌词
      lxlyric?: string | null
    }

    interface LyricInfoSave {
      id: string
      lyrics: LyricInfo
    }

    interface MusicUrlInfo {
      id: string
      url: string
    }

    interface MusicInfoOtherSourceSave {
      id: string
      list: MusicInfoOnline[]
    }

  }
}
