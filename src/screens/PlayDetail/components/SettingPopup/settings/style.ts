import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

export default createStyle({
  // 字体大小行容器（SettingLrcFontSize 专用）：双场景消费——横屏更多弹层 + 竖屏歌词动作行
  // SheetBase，调参须双场景走查（审查 S-D）；padding 与 Card.tsx ROW_PADDING 同值双源互指
  container: {
    paddingTop: SPACING.s12,
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingBottom: SPACING.s12,
    alignItems: 'flex-start',
  },
  // title: {

  // },
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
  list: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: SPACING.s6,
  },
  // 倍速行标题行（block 布局内嵌 row：label 撑满 + 右侧非预设当前值小字靠右）
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flexGrow: 1,
  },
  // 非预设历史倍速当前值小字（审查过渡期补偿：点任一预设归化后消失）
  rateText: {
    width: 48,
    textAlign: 'right',
  },
  // block 行内胶囊组与标题的行距（倍速/歌词对齐，2026-10-20 重构；
  // 2026-10-21 去 flexGrow/flexShrink——病灶成因：flexShrink 在 row+wrap 下吃掉换行）
  chips: {
    marginTop: SPACING.s10,
  },
})
