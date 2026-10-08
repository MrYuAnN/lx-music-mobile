import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { pushNavScreen } from '../utils'
import { createStyle } from '@/utils/tools'

// 首页顶栏的搜索胶囊（点击进入搜索屏），横竖屏共用
const SearchBox = () => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={styles.container}>
      <TouchableOpacity style={{ ...styles.searchBox, backgroundColor: theme['c-main-background'] }} onPress={() => { pushNavScreen('nav_search') }} activeOpacity={0.7}>
        <Icon name="search-2" color={theme['c-font-label']} size={16} />
        <Text style={styles.searchText} size={14} color={theme['c-font-label']}>{t('nav_search')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  searchBox: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    gap: 8,
    marginLeft: 4,
    marginRight: 4,
  },
  searchText: {
    flexShrink: 1,
  },
})

export default SearchBox
