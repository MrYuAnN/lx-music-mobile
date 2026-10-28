import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

// 「全源不可用」提示态（批1 阶段2 边界①）：/config 下发空源集时，搜索/榜单/歌单/热搜
// 四页数据区以本组件占位（选中源保持上一有效值，恢复后随 sourcesUpdated 自动复位）
export default () => {
  const theme = useTheme()
  const t = useI18n()
  return (
    <View style={styles.container}>
      <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('shiyin_all_sources_offline')}</Text>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  tip: {
    textAlign: 'center',
  },
})
