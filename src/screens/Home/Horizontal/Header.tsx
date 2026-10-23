import { View, StyleSheet } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import GlassSurface, { GLASS_BAR_FALLBACK } from '@/components/common/GlassSurface'
import StatusBar from '@/components/common/StatusBar'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 搜索类型 chips 在内容组件（Views/Search）内自渲染（问题 2），
// 页头不再挂 SearchTypeSelector——横屏双实例状态互不同步（架构师 I2 修复）

const HEADER_HEIGHT = _HEADER_HEIGHT * 0.8

// 横屏顶栏玻璃化（2026-10-23 全应用统一治理批 C）：**恒玻璃降档形态**——竖屏穿行渐显
// （onScroll 自驱）在此不适用：单例 Header 与 pane 组件树平级、无 scrollY 上行通道（方案审查
// 架构 I-2），overlay 化还需全 pane paddingTop 改造，回归风险高；恒玻璃无渐显为方案 §4 已备案
// 降档，玻璃语言与全体系一致（走查后如需穿行渐显再单独立项专项设计）
const LeftHeader = () => {
  const id = useNavActiveId()
  const t = useI18n()
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={{
      ...styles.container,
      height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
      paddingTop: statusBarHeight,
    }}>
      <View style={styles.barBgWrap} pointerEvents="none">
        <GlassSurface style={StyleSheet.absoluteFill} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
      </View>
      <View style={styles.left}>
        <Text style={styles.leftTitle} size={18}>{t(id)}</Text>
      </View>
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
  },
  barBgWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: SPACING.s6,
    alignItems: 'center',
    height: '100%',
  },
  leftTitle: {
    paddingLeft: SPACING.s10,
    paddingRight: SPACING.s16,
  },
})

export default Header
