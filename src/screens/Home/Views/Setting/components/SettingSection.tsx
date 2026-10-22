import { View } from 'react-native'

import SectionHeader from '@/components/common/SectionHeader'
import GlassSurface from '@/components/common/GlassSurface'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

// 设置节容器（2026-10-21 设置页重构，inset grouped 组卡式）：SectionHeader 卡外节头 +
// 圆角组卡。卡材质（2026-10-21 真机反馈三改定稿）：复用弹窗体系 GlassSurface 真毛玻璃
// （sbaiahmed1 库 BlurView，悬浮顶栏同源；不可用降级 fallbackColor=c-content-background），
// radius 12 + 四周发丝线——与全体系玻璃语言单源，零新依赖（中途误装的 community/blur 已撤）。
// 节间留白由节头 pt s24 承载，首节/横屏单节传 first 收敛（compactTop s4，顶部空旷反馈）；
// 水平缩进归宿主容器（竖屏 Main/横屏 main 均 px16），组件不自增。
interface Props {
  title: string
  children: React.ReactNode
  first?: boolean
}

export default ({ title, children, first = false }: Props) => {
  const theme = useTheme()

  return (
    <View>
      <SectionHeader label={title} compactTop={first} />
      <GlassSurface style={styles.card} radius={12} hairline="all" fallbackColor={theme['c-content-background']}>
        {children}
      </GlassSurface>
    </View>
  )
}

const styles = createStyle({
  card: {},
})
