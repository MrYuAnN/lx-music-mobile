import { memo, useCallback } from 'react'

import SettingSection from '../../components/SettingSection'
import SelectRow from '../../components/SelectRow'
import { useI18n } from '@/lang'
import { pushScreen } from '@/navigation'
import { MY_KEYS_SCREEN, PURCHASE_SCREEN } from '@/navigation/screenNames'
import { formatActivationState, useActivationState } from '@/core/shiyin/activation'

// 激活码节（KeyInfo 批，方案 §2.4）：设置页直通入口——「我的激活码」（value=状态摘要）+
// 「获取激活码」引导（灰度期人工发码=官网教程/客服）；对标净屏 SettingsActivity.rowKeys
// 置顶直觉。原关于页激活弹窗已退役（单入口原则，方案拍板 #2）。
// 批 R 形态修订（2026-11-01）：竖屏设置页改净屏式根菜单，两行提升根菜单激活组直达，
// 本节组件转**横屏专用**（SETTING_COMPONENTS 双端共用查表，横屏 Main 切换器仍渲染；
// 竖屏不再引用——D8 收口，文件保留勿删）
export default memo(() => {
  const t = useI18n()
  const { info } = useActivationState()

  const handleMyKeys = useCallback(() => {
    pushScreen(MY_KEYS_SCREEN)
  }, [])

  const handleGetCode = useCallback(() => {
    // 批3 v1.2：应用内选购页直达（替换 tutorial.html 外链）
    pushScreen(PURCHASE_SCREEN)
  }, [])

  return (
    <SettingSection title={t('setting_activation_section')}>
      <SelectRow label={t('setting_my_keys')} value={formatActivationState(info, t)} onPress={handleMyKeys} />
      <SelectRow label={t('setting_get_code')} value='' onPress={handleGetCode} />
    </SettingSection>
  )
})
