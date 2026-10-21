import { View } from 'react-native'

import SectionHeader from '@/components/common/SectionHeader'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

// 设置节容器（2026-10-21 设置页重构，inset grouped 组卡式）：SectionHeader 卡外节头 +
// 圆角组卡（卡色 c-content-background 自页面底「浮出」，底色 c-app-background 即 iOS
// systemGroupedBackground 现值，本批零改动）。节间留白由 SectionHeader pt s24 承载
// （弹层批三件套同源）；水平缩进归宿主容器（竖屏 Main/横屏 main 均 px16：节头 16+16=32
// 与卡内行 16+16 对齐），组件不自增。
interface Props {
  title: string
  children: React.ReactNode
}

export default ({ title, children }: Props) => {
  const theme = useTheme()

  return (
    <View>
      <SectionHeader label={title} />
      <View style={{ ...styles.card, backgroundColor: theme['c-content-background'] }}>
        {children}
      </View>
    </View>
  )
}

const styles = createStyle({
  card: {
    borderRadius: 8,
    overflow: 'hidden',
  },
})
