import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'

export default ({ selectedList, isMove }: {
  selectedList: LX.Music.MusicInfo[]
  isMove: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  return (
    <Text style={styles.title} size={16}>
      {t(isMove ? 'list_multi_add_title_first_move' : 'list_multi_add_title_first_add')} <Text color={theme['c-primary-font']} size={16}>{selectedList.length}</Text> {t('list_multi_add_title_last')}
    </Text>
  )
}

const styles = createStyle({
  title: {
    textAlign: 'center',
    paddingTop: SPACING.s16,
    paddingBottom: SPACING.s16,
  },
})
