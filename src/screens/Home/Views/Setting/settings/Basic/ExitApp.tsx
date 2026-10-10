import { memo } from 'react'

// AM-2：导航抽屉退役，退出应用入口自抽屉收编至此（doc/plans/apple-music-redesign.md §1.2）
import { confirmDialog, createStyle, exitApp } from '@/utils/tools'
import { useI18n } from '@/lang'
import Button from '../../components/Button'
import { View } from 'react-native'

export default memo(() => {
  const t = useI18n()

  const handleExit = () => {
    void confirmDialog({
      message: t('exit_app_tip'),
      confirmButtonText: t('list_remove_tip_button'),
    }).then(isExit => {
      if (!isExit) return
      exitApp()
    })
  }

  return (
    <View style={styles.container}>
      <Button onPress={handleExit}>{t('exit_app')}</Button>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    paddingLeft: 2,
    paddingTop: 2,
    paddingBottom: 6,
  },
})
