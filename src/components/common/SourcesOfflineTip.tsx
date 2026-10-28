import { useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { fetchShiyinConfig } from '@/core/shiyin/config'

// 「全源不可用」提示态（批1 阶段2 边界①）：/config 下发空源集时，搜索/榜单/歌单/热搜
// 四页数据区以本组件占位（选中源保持上一有效值）。自愈双路径（审查 I-E 拍板）：
// 空集定时链自动重拉（config.ts scheduleEmptyRetry）+ 本组件手动重试按钮。
export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [retrying, setRetrying] = useState(false)

  const handleRetry = () => {
    if (retrying) return
    setRetrying(true)
    void fetchShiyinConfig().catch(() => {
      toast(t('shiyin_all_sources_offline'))
    }).finally(() => {
      setRetrying(false)
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('shiyin_all_sources_offline')}</Text>
      <Button style={{ ...styles.retryBtn, backgroundColor: theme['c-button-background'] }} onPress={handleRetry}>
        <Text size={13} color={theme['c-button-font']}>{retrying ? t('version_tip_checking') : t('shiyin_retry')}</Text>
      </Button>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  tip: {
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 20,
    paddingRight: 20,
    borderRadius: 4,
  },
})
