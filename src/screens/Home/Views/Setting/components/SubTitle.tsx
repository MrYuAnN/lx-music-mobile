import { memo } from 'react'

import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { SPACING } from '@/config/spacing'

export default memo(({ title, children }: {
  title: string
  children: React.ReactNode | React.ReactNode[]
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  )
})


const styles = createStyle({
  container: {
    paddingLeft: SPACING.s26,
    marginBottom: SPACING.s18,
  },
  title: {
    marginLeft: -10,
    marginBottom: SPACING.s10,
    // lineHeight: 16,
  },
})
