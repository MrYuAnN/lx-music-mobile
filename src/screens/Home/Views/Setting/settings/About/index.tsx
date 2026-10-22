import { memo, useCallback } from 'react'

import SettingSection from '../../components/SettingSection'
import SelectRow from '../../components/SelectRow'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'

const currentVer = process.versions.app

// 关于节（2026-10-23 重设计：两行带图标行退役，改入口行 push 独立关于页——品牌区+检查更新+版权，
// 对标网易云设置「关于网易云音乐」入口行进独立页；设置页八节平铺架构不变。
// 状态机与品牌区已迁 screens/About。SettingSection 组卡包裹与其他节同构（首轮实现漏包裹致裸行））
export default memo(() => {
  const t = useI18n()

  const handlePress = useCallback(() => {
    const componentId = commonState.componentIds.setting
    if (componentId) navigations.pushAboutScreen(componentId)
  }, [])

  return (
    <SettingSection title={t('setting_about')}>
      <SelectRow label={t('setting_about')} value={currentVer} onPress={handlePress} />
    </SettingSection>
  )
})
