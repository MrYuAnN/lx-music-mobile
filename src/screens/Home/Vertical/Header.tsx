import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'
import SearchBox from '../components/SearchBox'

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
})
