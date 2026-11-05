import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

export default createStyle({
  // 字体大小行容器（SettingLrcFontSize 专用）：双场景消费——横屏更多弹层 + 竖屏歌词动作行
  // SheetBase，调参须双场景走查（审查 S-D）；padding 与 Card.tsx ROW_PADDING 同值双源互指
  // （py s8 组内致密，同 Card）
  container: {
    paddingTop: SPACING.s8,
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingBottom: SPACING.s8,
    alignItems: 'flex-start',
  },
  label: {
    width: 50,
    textAlign: 'center',
  },
  content: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  // 行前置图标（2026-11-05 弹窗重构 AM 三件套：定时/倍速/黑名单三行同构，审查 S1 收口单源）
  icon: {
    marginRight: SPACING.s12,
  },
  // 2026-11-05 真机反馈轮：titleRow/title/rateText/chips/list 为旧倍速 chips 行专用键，
  // 全档位 chips 改单值上下步进行后无消费，删除（SettingPlaybackRate 行内样式自持）
})
