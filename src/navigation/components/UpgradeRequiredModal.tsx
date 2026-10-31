// ⑤ min_client_version 强更弹窗（批2；方案 §三E）：可关闭+「立即更新」跳 upgrade_url
// （空则 fallback /latest，v3 定稿 R7）。形态复用弹窗体系基建（S7，VersionModal 同款
// ModalContent+store 驱动）；触发期抑制常规检查更新弹窗（S1 互斥，见 core/version.ts）。
import { memo, useCallback } from 'react'
import { View } from 'react-native'

import Button from '@/components/common/Button'
import { createStyle, openUrl } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useUpgradeRequired } from '@/store/version/hook'
import ModalContent from './ModalContent'
import { SPACING } from '@/config/spacing'
import { SHIYIN_BASE_URL } from '@/core/shiyin/config'

const UpgradeRequiredModal = () => {
  const theme = useTheme()
  const t = useI18n()
  const info = useUpgradeRequired()

  const handleUpdate = useCallback(() => {
    // upgrade_url 空/死链兜底 /latest（服务端强更契约：/latest 永不设版本门槛，方案 §七）
    void openUrl(info.url || `${SHIYIN_BASE_URL}/latest`).catch(() => {})
  }, [info.url])

  return (
    <ModalContent>
      <View style={styles.main}>
        <Text style={styles.title}>{t('upgrade_required_title')}</Text>
        <Text style={styles.desc}>{t('upgrade_required_desc')}</Text>
      </View>
      <View style={styles.btns}>
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleUpdate}>
          <Text color={theme['c-button-font']}>{t('upgrade_required_btn_update')}</Text>
        </Button>
      </View>
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    marginTop: SPACING.s16,
    marginLeft: SPACING.s16,
    marginRight: SPACING.s16,
    marginBottom: SPACING.s20,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: SPACING.s16,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: SPACING.s16,
    paddingLeft: SPACING.s16,
  },
  btn: {
    flex: 1,
    paddingTop: SPACING.s10,
    paddingBottom: SPACING.s10,
    paddingLeft: SPACING.s10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: SPACING.s16,
  },
})

export default memo(UpgradeRequiredModal)
