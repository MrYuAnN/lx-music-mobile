import { View } from 'react-native'

import SectionHeader from '@/components/common/SectionHeader'
import { getGlassHairlineColor } from '@/components/common/GlassSurface'
import { BorderWidths } from '@/theme'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

// 设置节容器（2026-10-21 设置页重构，inset grouped 组卡式）：SectionHeader 卡外节头 +
// 圆角组卡。卡材质（2026-10-23 全应用 UI 统一治理拍板 #2/#7 终局）：组卡退出玻璃材质回归
// 双层律内容层——实色 c-content-background + 四周发丝线（色值单源 GLASS_HAIRLINE_COLOR、
// 线宽 BorderWidths.normal）+ radius 12（M3 card medium 对标）；10-21 玻璃卡拍板随之撤回，
// 其余结构（节头/留白/缩进分工）不变。
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
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme['c-content-background'],
            borderColor: getGlassHairlineColor(theme.isDark),
          },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = createStyle({
  card: {
    borderRadius: 12,
    borderWidth: BorderWidths.normal,
    overflow: 'hidden',
  },
})
