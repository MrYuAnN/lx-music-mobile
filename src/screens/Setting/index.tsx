import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'

import Setting from '../Home/Views/Setting'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS, SCREEN_HEADER_HEIGHT } from '@/config/constant'

// AM-2：原 Home 内嵌 View screen 化（doc/plans/apple-music-redesign.md §3.1）
// 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：header 悬浮玻璃，设置列表延伸整屏
// paddingTop 补偿（scrollYAnimated/contentPaddingTop 经 View 组件可选 prop 下传，
// 横屏 pager 宿主不传零 diff）
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const scrollY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // 屏级 componentId 注册（治理批 P5）：设置页内二级跳转（黑名单管理页等）寻址用，
    // 与 home/playDetail 同款模式
    setComponentId(COMPONENT_IDS.setting, componentId)
  }, [componentId])

  return (
    <PageContent>
      <View style={{ flex: 1 }}>
        <Setting scrollYAnimated={scrollY} contentPaddingTop={statusBarHeight + SCREEN_HEADER_HEIGHT} />
        {/* 悬浮头后声明（RN 后声明者在上，C-1 层级修复） */}
        <ScreenHeader componentId={componentId} title={t('nav_setting')} progress={scrollY} alwaysShowTitle />
      </View>
      <PlayerBarPlaceholder />
    </PageContent>
  )
}
