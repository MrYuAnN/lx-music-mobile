import { memo } from 'react'
import { View } from 'react-native'
import Text, { FontFamilies } from './Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n, type Message } from '@/lang'
import { createStyle } from '@/utils/tools'
import { getOnlineQualitys, qualityTier, type QualityTierKey } from '@/utils/music'
import { SPACING } from '@/config/spacing'

export { getOnlineQualitys }

// 音质档位映射：flac24bit→母带 金 / flac|ape|wav→无损 绿 / 320k|192k→高品 蓝灰 / 128k→标准 灰
// 四档全打标（2026-10-12 拍板，推翻原「128k 不打标」图例）；回切=删除 128k 映射行
type QualityColorKey = 'c-quality-24bit' | 'c-quality-sq' | 'c-quality-hq' | 'c-source-wy' | 'c-source-tx' | 'c-source-kg' | 'c-source-kw' | 'c-source-mg' | 'c-font-label'
// 来源文字色走主题变量（亮色深化达 WCAG AA）；品牌原色仅作淡底（8% alpha 混底明暗自适应、不随主题）。
// 五源封闭值域，miss 回退 c-font-label 中性灰，防未来新增源漏配
const SOURCE_COLOR_KEYS: Record<string, QualityColorKey> = {
  wy: 'c-source-wy',
  tx: 'c-source-tx',
  kg: 'c-source-kg',
  kw: 'c-source-kw',
  mg: 'c-source-mg',
}
const SOURCE_BRAND_COLORS: Record<string, string> = {
  wy: '#C20C0C',
  tx: '#31C27C',
  kg: '#1E84E4',
  kw: '#FF9F1A',
  mg: '#F30062',
}
const TIER_COLORS: Record<QualityTierKey, QualityColorKey> = {
  quality_128k: 'c-font-label',
  quality_high_quality: 'c-quality-hq',
  quality_lossless: 'c-quality-sq',
  quality_lossless_24bit: 'c-quality-24bit',
}
const getQualityTagInfo = (qualitys?: LX.Music._MusicQualityType): { textKey: QualityTierKey, color: QualityColorKey } | null => {
  if (!qualitys) return null
  // 布尔域判存用 ||（?? 对显式 false 不兜底）；档位归一单源 qualityTier（与 qualityLabel 共用）
  let quality: LX.Quality | null = null
  if (qualitys.flac24bit) quality = 'flac24bit'
  else if (qualitys.flac || qualitys.ape) quality = 'flac'
  else if (qualitys.wav) quality = 'wav'
  else if (qualitys['320k'] || qualitys['192k']) quality = '320k'
  else if (qualitys['128k']) quality = '128k'
  if (!quality) return null
  const textKey = qualityTier(quality)
  return { textKey, color: TIER_COLORS[textKey] }
}

// 淡底圆角矩形 r4（2026-10-16 拍板：对标 QQ/网易云/Tidal 矩形系音质标，业界无胶囊先例；
// 与可点控件语义分级——信息标 r4 < 字段/输入 r8 < 交互 chips r999）：底=文字色 12% alpha、无描边；
// includeFontPadding:false +
// lineHeight 对齐盒高，修 Android 小字号文字偏下。c-font-label 走主题覆盖路径，非 6 位 hex 时回退固定灰
// 来源标签传更低 alpha（从属元数据低于音质一档：同形态靠尺寸+透明度分级）。
// 导出共享：OnlineList 排行榜前三序号徽章等淡底场景复用，防 alpha 档位多源漂移
export const getTintBackground = (color: string, alpha = '1F'): string => {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? `${color}${alpha}` : `#8A8A8E${alpha}`
}

export default memo(({ qualitys, source, showSource }: {
  qualitys?: LX.Music._MusicQualityType
  source?: string
  showSource?: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  const tagInfo = getQualityTagInfo(qualitys)
  const sourceColorKey = source ? SOURCE_COLOR_KEYS[source] : undefined
  const sourceColor = sourceColorKey ? theme[sourceColorKey] : theme['c-font-label']
  const sourceBrandColor = source ? SOURCE_BRAND_COLORS[source] : undefined

  if (!tagInfo && !(showSource && source)) return null

  return (
    <View style={styles.container}>
      {
        tagInfo
          ? (
              <View style={{ ...styles.tag, backgroundColor: getTintBackground(theme[tagInfo.color]) }}>
                <Text style={styles.tagText} size={10} color={theme[tagInfo.color]}>{t(tagInfo.textKey)}</Text>
              </View>
            )
          : null
      }
      {
        showSource && source
          ? (
              // 从属元数据低于音质一档：小一号（高 14/字 9）+ 更淡底（8% vs 12%），
              // 不引入描边等新形态语言（层级靠尺寸+透明度分级）；固定 minWidth 防两字母源名（QQ）偏窄不齐
              <View style={{ ...styles.sourceTag, backgroundColor: getTintBackground(sourceBrandColor ?? theme['c-font-label'], '14') }}>
                <Text style={styles.sourceTagText} size={9} color={sourceColor} numberOfLines={1}>{t(`source_short_${source}` as keyof Message) || source}</Text>
              </View>
            )
          : null
      }
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tag: {
    height: 16,
    paddingHorizontal: SPACING.s4,
    borderRadius: 4,
    justifyContent: 'center',
    marginRight: SPACING.s4,
  },
  tagText: {
    fontFamily: FontFamilies.medium,
    lineHeight: 16,
    includeFontPadding: false,
    letterSpacing: 0.3,
  },
  sourceTag: {
    height: 14,
    minWidth: 36,
    paddingHorizontal: SPACING.s4,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s4,
  },
  sourceTagText: {
    fontFamily: FontFamilies.medium,
    lineHeight: 14,
    includeFontPadding: false,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
})
