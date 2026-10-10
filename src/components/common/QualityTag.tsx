import { memo } from 'react'
import { View } from 'react-native'
import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { getOnlineQualitys } from '@/utils/music'

export { getOnlineQualitys }

// 音质等级映射：flac24bit→24bit 金 / flac|ape→SQ 绿 / 320k→HQ 蓝灰 / 128k、wav、192k 无标签（原型图例拍板）
type QualityColorKey = 'c-quality-24bit' | 'c-quality-sq' | 'c-quality-hq'
export const getQualityTagInfo = (qualitys?: LX.Music._MusicQualityType): { text: string, color: QualityColorKey } | null => {
  if (!qualitys) return null
  if (qualitys.flac24bit) return { text: '24bit', color: 'c-quality-24bit' }
  if (qualitys.flac ?? qualitys.ape) return { text: 'SQ', color: 'c-quality-sq' }
  if (qualitys['320k']) return { text: 'HQ', color: 'c-quality-hq' }
  return null
}

// 描边多彩音质标签（高15 r3 字9 描边1，边框=文字色，透明底）；来源标签同形态用 c-font-label 灰
export default memo(({ qualitys, source, showSource }: {
  qualitys?: LX.Music._MusicQualityType
  source?: string
  showSource?: boolean
}) => {
  const theme = useTheme()
  const tagInfo = getQualityTagInfo(qualitys)

  if (!tagInfo && !(showSource && source)) return null

  return (
    <View style={styles.container}>
      {
        tagInfo
          ? (
              <View style={{ ...styles.tag, borderColor: theme[tagInfo.color] }}>
                <Text style={{ color: theme[tagInfo.color] }} size={9}>{tagInfo.text}</Text>
              </View>
            )
          : null
      }
      {
        showSource && source
          ? (
              <View style={{ ...styles.tag, borderColor: theme['c-font-label'] }}>
                <Text style={styles.sourceText} size={9} color={theme['c-font-label']}>{source}</Text>
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
    height: 15,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 3,
    justifyContent: 'center',
    marginRight: 4,
  },
  sourceText: {
    letterSpacing: 0.3,
  },
})
