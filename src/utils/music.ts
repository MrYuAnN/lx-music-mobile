import { existsFile } from './fs'
import type { useI18n } from '@/lang'


export const getLocalFilePath = async(musicInfo: SY.Music.MusicInfoLocal): Promise<string> => {
  if (await existsFile(musicInfo.meta.filePath)) return musicInfo.meta.filePath
  // 直接从应用外 intent 调用打开的文件，ogg等类型无法判断文件是否存在，但这类文件路径为纯数字
  return /\/\d+$/.test(musicInfo.meta.filePath) ? musicInfo.meta.filePath : ''
}

/** 本地路径转播放可用 URL：RNTP 安卓层 Uri.parse 直通 ExoPlayer，裸绝对路径无 scheme 播放报错
 * （走查反馈②：下载曲本地播放报错→在线兜底，与 getPicUrl 的 file:// 前缀同款处理），
 * content:// 等已有 scheme 的输入原样返回 */
export const toLocalFileUrl = (path: string) => path.startsWith('/') ? `file://${path}` : path

/** online 行音质元数据提取；统一行/PlayListPanel/下载引擎共用。
 * meta 可选链防御（2026-10-20 真机崩溃：外部源数据存在 meta 缺失条目，如聚合/异常解析结果）。
 * 下载曲 local 条目（2026-10-29 题3）：回填档 → 原曲在线档（存量歌单条目无回填时兜底）；
 * 裸本地文件仍 undefined（无音质概念，行降级） */
export const getOnlineQualitys = (item: SY.Music.MusicInfo): SY.Music._MusicQualityType | undefined => {
  if (item.source != 'local') return item.meta?._qualitys
  return item.meta?._qualitys ?? item.meta.onlineInfo?.meta?._qualitys
}

/** 在线身份归一（2026-10-29 题3 定稿）：本 app 下载曲（local+onlineInfo）按原曲在线身份呈现/入队——
 * 下载是歌曲属性非身份（Spotify/AM/QQ/网易云一致模型）；裸本地文件原样返回。
 * 歌单行角标/音质判定、下载槽三态判定 key 统一经此取数（禁用 meta.songId——本地场景被覆写为路径） */
export const toOnlineIdentity = (item: SY.Music.MusicInfo): SY.Music.MusicInfo => {
  return item.source == 'local' && item.meta.onlineInfo ? item.meta.onlineInfo : item
}

// 音质档位归一单源（列表标签色/文案与设置页/选项文案共用，防双处维护漂移）：
// 128k=标准，192k/320k=高品，flac/ape/wav=无损，flac24bit=母带
export type QualityTierKey = 'quality_128k' | 'quality_high_quality' | 'quality_lossless' | 'quality_lossless_24bit'
export const qualityTier = (quality: SY.Quality): QualityTierKey => {
  switch (quality) {
    case '128k':
      return 'quality_128k'
    case '192k':
    case '320k':
      return 'quality_high_quality'
    case 'flac':
    case 'ape':
    case 'wav':
      return 'quality_lossless'
    case 'flac24bit':
      return 'quality_lossless_24bit'
  }
}

export const qualityLabel = (quality: SY.Quality, t: ReturnType<typeof useI18n>) => {
  return t(qualityTier(quality))
}

/** 音质文案+已下载标记单源（2026-10-29 审查 S-3）：音质面板/下载弹窗两处共用防漂移 */
export const qualityLabelMarked = (quality: SY.Quality, downloadedQuality: SY.Quality | undefined, t: ReturnType<typeof useI18n>) => {
  return quality == downloadedQuality ? `${qualityLabel(quality, t)} · ${t('download_mark_downloaded')}` : qualityLabel(quality, t)
}
