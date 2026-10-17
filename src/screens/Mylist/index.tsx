import { useCallback } from 'react'

import StatusBar from '@/components/common/StatusBar'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { pop } from '@/navigation'
import MylistView from '../Home/Views/Mylist'

// AM-2：原 Home 内嵌 View screen 化（doc/plans/apple-music-redesign.md §3.1）；
// 歌单页重构批（真机反馈 2026-10-17）：结构同构 SonglistDetail——ScreenHeader/外层白底
// PageContent 退役，氛围层由内层组件负责，顶部仅 ←/搜索/⋮ 图标行浮于氛围层上
// （StatusBar 组件同款 SonglistDetail、摆位在 Fragment 顶层同 Horizontal：纯样式无布局
// 占位，且限定 push 形态、隔离横屏 pane）
export default ({ componentId }: { componentId: string }) => {
  // 稳定引用防壳屏重渲染打穿内层 header useMemo 与 PlaylistHeader memo（方案审查 S3）
  const handleBack = useCallback(() => { pop(componentId) }, [componentId])

  return (
    <>
      <StatusBar />
      <MylistView showBack onBack={handleBack} footer={<PlayerBarPlaceholder />} />
    </>
  )
}
