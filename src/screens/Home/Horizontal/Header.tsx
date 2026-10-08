import { View } from 'react-native'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import SearchTypeSelector from '@/screens/Home/Views/Search/SearchTypeSelector'

// 导航中间态（批次②）：内容区固定为搜索页，标题与类型选择器随之固定；批次④统一收口
const HEADER_HEIGHT = _HEADER_HEIGHT * 0.8

const Header = () => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={{
      ...styles.container,
      height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
      paddingTop: statusBarHeight,
    }}>
      <StatusBar />
      <View style={styles.left}>
        <Text style={styles.leftTitle} size={18}>{t('nav_search')}</Text>
      </View>
      <SearchTypeSelector />
    </View>
  )
}

const styles = createStyle({
  container: {
    paddingRight: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: 5,
    alignItems: 'center',
    height: '100%',
  },
  leftTitle: {
    paddingLeft: 10,
    paddingRight: 16,
  },
})

export default Header
