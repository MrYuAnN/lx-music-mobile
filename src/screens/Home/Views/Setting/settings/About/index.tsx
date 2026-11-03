import { memo, useCallback } from 'react'

import SettingSection from '../../components/SettingSection'
import SelectRow from '../../components/SelectRow'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { checkUpdate } from '@/core/version'
import { useUpdateStatusText } from '@/utils/hooks/useUpdateStatusText'
import { createStyle, openUrl, toast } from '@/utils/tools'
import { SHIYIN_BASE_URL } from '@/core/shiyin/config'

// 关于节（横屏专用；竖屏根菜单关于组为同构三行——定案#1 去重后双端同语言）：检查更新
// （微信式 value，定案#2）+更新日志+联系客服。原「关于拾音」入口行与独立 About 页已随
// 定案#1 退役（2026-11-01）；版权小字归竖屏列表尾/横屏节尾。
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const statusText = useUpdateStatusText()
  const componentId = commonState.componentIds.setting

  const handleCheckUpdate = useCallback(() => {
    void checkUpdate().then(res => {
      if (res == 'latest') toast(t('version_tip_latest'))
    })
  }, [t])

  return (
    <SettingSection title={t('setting_about')}>
      <SelectRow icon="arrow-clockwise" label={t('about_check_update')} value={statusText} onPress={handleCheckUpdate} />
      <SelectRow icon="list-order" label={t('about_changelog')} value='' onPress={() => { if (componentId) navigations.pushChangelogScreen(componentId) }} />
      <SelectRow icon="help" label={t('setting_contact')} value='' onPress={() => { void openUrl(`${SHIYIN_BASE_URL}/faq`) }} />
      <Text size={11} color={theme['c-font-label']} style={styles.copyright}>
        {t('about_copyright', { year: new Date().getFullYear() })}
      </Text>
    </SettingSection>
  )
})

const styles = createStyle({
  copyright: {
    textAlign: 'center',
    paddingTop: 12,
  },
})
