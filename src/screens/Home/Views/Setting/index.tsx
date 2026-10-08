import Main from './Main'
import { type SettingScreenIds } from './constant'

export type { SettingScreenIds } from './constant'

export default ({ initialAnchor }: { initialAnchor?: SettingScreenIds }) => {
  // 横竖屏共用同一长页（横屏限宽居中），原横屏单分类切换布局已移除
  return <Main initialAnchor={initialAnchor} />
}
