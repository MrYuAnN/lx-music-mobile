import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

export default createStyle({
  container: {
    paddingTop: 5,
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
    paddingTop: 5,
  },
})
