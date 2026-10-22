import { useRef } from 'react'
import { Animated, View } from 'react-native'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import Search from '../Home/Views/Search'

// AM-2：原 Home 内嵌 View screen 化（doc/plans/apple-music-redesign.md §3.1）
// 顶部顺序（问题 2）：页头 → 搜索框 → 类型 chips → 列表（后两层在 Search 组件内）
// 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5 Search 单列方案）：搜索框+chips 钉悬浮头区整组
// 常驻，列表延伸整屏 paddingTop 补偿
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const scrollY = useRef(new Animated.Value(0)).current

  return (
    <PageContent>
      <View style={{ flex: 1 }}>
        <Search scrollYAnimated={scrollY} contentPaddingTop={statusBarHeight + SCREEN_HEADER_HEIGHT} />
        {/* 悬浮头后声明（RN 后声明者在上，C-1 层级修复） */}
        {/* 标题常显（2026-10-22 治理批 P15：撤销 10-19「搜索框即身份」豁免，回归「有钉位子头→标题常显」通用判据） */}
        <ScreenHeader componentId={componentId} title={t('nav_search')} progress={scrollY} alwaysShowTitle />
      </View>
      <PlayerBarPlaceholder />
    </PageContent>
  )
}
