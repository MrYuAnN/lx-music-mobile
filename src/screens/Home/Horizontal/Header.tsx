import { View } from 'react-native'
import { useStatusbarHeight } from '@/store/common/hook'
import StatusBar from '@/components/common/StatusBar'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import SearchBox from '../components/SearchBox'

const HEADER_HEIGHT = _HEADER_HEIGHT * 0.8

// 横屏顶栏：搜索胶囊（抽屉由常驻 Aside 承担，无汉堡按钮）
const Header = () => {
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={{
      height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
      paddingTop: statusBarHeight,
      justifyContent: 'center',
    }}>
      <StatusBar />
      <SearchBox />
    </View>
  )
}

export default Header
