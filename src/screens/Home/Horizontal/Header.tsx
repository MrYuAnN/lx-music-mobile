import { View } from 'react-native'
// import Button from '@/components/common/Button'
// import { navigations } from '@/navigation'
// import { BorderWidths } from '@/theme'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 搜索类型 chips 在内容组件（Views/Search）内自渲染（问题 2），
// 页头不再挂 SearchTypeSelector——横屏双实例状态互不同步（架构师 I2 修复）

const HEADER_HEIGHT = _HEADER_HEIGHT * 0.8


// const LeftTitle = () => {
//   const id = useNavActiveId()
//   const t = useI18n()

//   return <Text style={styles.leftTitle} size={18}>{t(id)}</Text>
// }
const LeftHeader = () => {
  const id = useNavActiveId()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={{
      ...styles.container,
      height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
      paddingTop: statusBarHeight,
    }}>
      <View style={styles.left}>
        <Text style={styles.leftTitle} size={18}>{t(id)}</Text>
      </View>

      {/* <TouchableOpacity style={styles.btn} onPress={openSetting}>
        <Icon style={{ ...styles.btnText, color: theme['c-font'] }} name="setting" size={styles.btnText.fontSize} />
      </TouchableOpacity> */}
    </View>
  )
}


const Header = () => {
  // AM-2：导航抽屉退役，标题栏固定左置（原 drawerLayoutPosition 镜像逻辑随之退役）
  return (
    <>
      <StatusBar />
      <LeftHeader />
    </>
  )
}


const styles = createStyle({
  container: {
    // width: '100%',
    paddingRight: SPACING.s6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 10,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: SPACING.s6,
    alignItems: 'center',
    height: '100%',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  btn: {
    // flex: 1,
    width: HEADER_HEIGHT,
    // backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  titleBtn: {
    flex: 1,
    // backgroundColor: 'rgba(0,0,0,0.1)',
    height: '100%',
    justifyContent: 'center',
  },
  leftTitle: {
    paddingLeft: 10,
    paddingRight: 16,
  },
  rightTitle: {
    paddingLeft: 16,
    paddingRight: 16,
  },
})

export default Header
