// ⑤ min_client_version 强更弹窗（批2；方案 §三E）：可关闭+「立即更新」跳 upgrade_url
// （空则 fallback /latest，v3 定稿 R7）。形态复用弹窗体系基建（S7，VersionModal 同款
// ModalContent+store 驱动）；触发期抑制常规检查更新弹窗（S1 互斥，见 core/version.ts）。
import { memo, useCallback } from 'react'
import { View } from 'react-native'

import Button from '@/components/common/Button'
import { createStyle, openUrl } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text, { FontFamilies } from '@/components/common/Text'
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
        {/* 主钮 c-primary 实底（2026-11-06 审查拍板：与 VersionModal 主钮同式样，强更钮本质=主行动作） */}
        <Button style={{ ...styles.btn, backgroundColor: theme['c-primary'] }} onPress={handleUpdate}>
          <Text size={14} numberOfLines={1} style={styles.btnText} color={theme['c-on-primary']}>{t('upgrade_required_btn_update')}</Text>
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
    // padding s12 与 VersionModal 主钮完全一致（审查 S-4 拍板「完全一致」）；单钮布局
    // （无 gap/marginRight 节奏差异）为本弹窗单键形态自有，不随对齐
    paddingTop: SPACING.s12,
    paddingBottom: SPACING.s12,
    paddingLeft: SPACING.s10,
    alignItems: 'center',
    borderRadius: 8, // 圆角档（随 VersionModal 主钮对齐，原 4）
    marginRight: SPACING.s16,
  },
  btnText: {
    fontFamily: FontFamilies.semibold,
  },
})

export default memo(UpgradeRequiredModal)
