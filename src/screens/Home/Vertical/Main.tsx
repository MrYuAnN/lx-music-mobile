import { ScrollView } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import MyList from '../Views/Mylist/MyList'
import ContinuePlayCard from './components/ContinuePlayCard'
import QuickNav from './components/QuickNav'
import { createStyle } from '@/utils/tools'

const Main = () => {
  const t = useI18n()
  const theme = useTheme()

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps={'handled'}>
      <ContinuePlayCard />
      <QuickNav />
      <Text style={{ ...styles.sectionTitle, color: theme['c-font'] }} size={18}>{t('nav_love')}</Text>
      <MyList />
    </ScrollView>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 4,
    marginLeft: 16,
    fontWeight: 'bold',
  },
})

export default Main
