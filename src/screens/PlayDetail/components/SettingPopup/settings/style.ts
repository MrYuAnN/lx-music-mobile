import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

export default createStyle({
  container: {
    paddingTop: SPACING.s6,
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingBottom: SPACING.s16,
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
  // 倍速行卡 label（flexGrow 撑满行，右侧非预设当前值小字靠右）
  title: {
    flexGrow: 1,
  },
  // 非预设历史倍速当前值小字（审查过渡期补偿：点任一预设归化后消失）
  rateText: {
    width: 48,
    textAlign: 'right',
  },
  // 行卡内胶囊组与 label 的间距（倍速/歌词对齐，2026-10-20 重构）
  chips: {
    flexGrow: 1,
    flexShrink: 1,
    marginTop: SPACING.s10,
  },
})
