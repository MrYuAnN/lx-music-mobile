import { SPACING } from './spacing'

// 表单行内边距单源（2026-10-21 设置页重构+更多弹层治理共享，审查 S-A 定案抽共享不互指）：
// 水平 16 贴卡内/面板单一网格，垂直 8 致密行距（组内致密+组间大留白的分组三件套配套）
export const FORM_ROW_PADDING = {
  paddingLeft: SPACING.s16,
  paddingRight: SPACING.s16,
  paddingTop: SPACING.s8,
  paddingBottom: SPACING.s8,
}
