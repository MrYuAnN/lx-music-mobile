import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { pushNavScreen } from '../utils'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'

const SearchBox = () => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <TouchableOpacity style={{ ...styles.searchBox, backgroundColor: theme['c-main-background'] }} onPress={() => { pushNavScreen('nav_search') }} activeOpacity={0.7}>
      <Icon name="search-2" color={theme['c-font-label']} size={16} />
      <Text style={styles.searchText} size={14} color={theme['c-font-label']}>{t('nav_search')}</Text>
    </TouchableOpacity>
  )
}

export default () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')

  const openMenu = () => {
    global.app_event.changeMenuVisible(true)
  }

  const menuBtn = (
    <TouchableOpacity style={styles.btn} onPress={openMenu}>
      <Icon color={theme['c-font']} name="menu" size={18} />
    </TouchableOpacity>
  )

  return (
    <View style={{ height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight, paddingTop: statusBarHeight }}>
      <StatusBar />
      <View style={styles.container}>
        {drawerLayoutPosition == 'left' ? menuBtn : null}
        <SearchBox />
        {drawerLayoutPosition == 'right' ? menuBtn : null}
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 8,
  },
  btn: {
    width: 40,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
