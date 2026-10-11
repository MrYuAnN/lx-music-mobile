import { existsFile } from './fs'
import type { useI18n } from '@/lang'


export const getLocalFilePath = async(musicInfo: LX.Music.MusicInfoLocal): Promise<string> => {
  if (await existsFile(musicInfo.meta.filePath)) return musicInfo.meta.filePath
  // 直接从应用外 intent 调用打开的文件，ogg等类型无法判断文件是否存在，但这类文件路径为纯数字
  return /\/\d+$/.test(musicInfo.meta.filePath) ? musicInfo.meta.filePath : ''
}

/** online 行音质元数据提取（local 无 _qualitys 返回 undefined）；统一行/PlayListPanel/下载引擎共用 */
export const getOnlineQualitys = (item: LX.Music.MusicInfo): LX.Music._MusicQualityType | undefined => {
  return item.source == 'local' ? undefined : (item.meta)._qualitys
}

// 音质档位文案（与播放页 ActionRow 同口径：128k=标准，HQ/SQ/24bit 复用既有键；ape 归 SQ 档语义）
export const qualityLabel = (quality: LX.Quality, t: ReturnType<typeof useI18n>) => {
  switch (quality) {
    case '128k':
      return t('quality_128k')
    case '320k':
      return t('quality_high_quality')
    case 'flac':
    case 'ape':
      return t('quality_lossless')
    case 'flac24bit':
      return t('quality_lossless_24bit')
    default:
      return quality
  }
}
