import { memo } from 'react'

import Button, { type BtnProps } from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

export interface ButtonProps extends BtnProps {
  size?: number
}

export default memo(({ disabled, size = 14, onPress, children }: ButtonProps) => {
  const theme = useTheme()

  return (
    <Button style={{ ...styles.button, backgroundColor: theme['c-button-background'] }} onPress={onPress} disabled={disabled}>
      <Text size={size} color={theme['c-button-font']}>{children}</Text>
    </Button>
  )
})

const styles = createStyle({
  button: {
    paddingHorizontal: 10,
    paddingVertical: SPACING.s6,
    borderRadius: 4,
    marginRight: 10,
  },
})
