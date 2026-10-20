import { useRef } from 'react'
import { Animated, View } from 'react-native'
import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { SCREEN_HEADER_HEIGHT } from '@/config/constant'
import SongList from '../Home/Views/SongList'

// AM-2：原 Home 内嵌 View screen 化（doc/plans/apple-music-redesign.md §3.1）
// 顶栏族穿行化（毛玻璃全体系阶段三，方案 §5）：header 悬浮玻璃，歌单广场列表延伸整屏 paddingTop 补偿
export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const scrollY = useRef(new Animated.Value(0)).current

  return (
    <PageContent>
      <View style={{ flex: 1 }}>
        <SongList scrollYAnimated={scrollY} contentPaddingTop={statusBarHeight + SCREEN_HEADER_HEIGHT} />
        {/* 悬浮头后声明（RN 后声明者在上，C-1 层级修复）；恒显标题（有钉位子头判据 2026-10-20） */}
        <ScreenHeader componentId={componentId} title={t('nav_songlist')} progress={scrollY} alwaysShowTitle />
      </View>
      <PlayerBarPlaceholder />
    </PageContent>
  )
}
