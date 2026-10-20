import { existsFile } from './fs'
import type { useI18n } from '@/lang'


export const getLocalFilePath = async(musicInfo: LX.Music.MusicInfoLocal): Promise<string> => {
  if (await existsFile(musicInfo.meta.filePath)) return musicInfo.meta.filePath
  // 直接从应用外 intent 调用打开的文件，ogg等类型无法判断文件是否存在，但这类文件路径为纯数字
  return /\/\d+$/.test(musicInfo.meta.filePath) ? musicInfo.meta.filePath : ''
}

/** online 行音质元数据提取（local 无 _qualitys 返回 undefined）；统一行/PlayListPanel/下载引擎共用。
 * meta 可选链防御（2026-10-20 真机崩溃：外部源数据存在 meta 缺失条目，如聚合/异常解析结果） */
export const getOnlineQualitys = (item: LX.Music.MusicInfo): LX.Music._MusicQualityType | undefined => {
  return item.source == 'local' ? undefined : item.meta?._qualitys
}

// 音质档位归一单源（列表标签色/文案与设置页/选项文案共用，防双处维护漂移）：
// 128k=标准，192k/320k=高品，flac/ape/wav=无损，flac24bit=母带
export type QualityTierKey = 'quality_128k' | 'quality_high_quality' | 'quality_lossless' | 'quality_lossless_24bit'
export const qualityTier = (quality: LX.Quality): QualityTierKey => {
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

export const qualityLabel = (quality: LX.Quality, t: ReturnType<typeof useI18n>) => {
  return t(qualityTier(quality))
}
