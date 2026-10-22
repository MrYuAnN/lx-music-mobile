import { memo, useRef } from 'react'

import SettingSection from '../../components/SettingSection'
import ActionRow from '../../components/ActionRow'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { FORM_ROW_PADDING } from '@/config/form'
import ListImportExport, { type ListImportExportType } from './ListImportExport'

// 备份与恢复节（治理批 P12：功能保留——删同步后唯一迁移通道+桌面版列表文件互通；
// 样式组卡化，导入/导出改文字动作行，「与桌面版列表备份文件通用」归节内说明行。
// 旧 SubTitle+填充矩形按钮形态退役）
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const listImportExportRef = useRef<ListImportExportType>(null)

  return (
    <SettingSection title={t('setting_backup')}>
      <Text size={12} color={theme['c-font-label']} style={styles.desc} numberOfLines={2}>{t('setting_backup_part')}</Text>
      <ActionRow label={t('setting_backup_part_import_list')} onPress={() => listImportExportRef.current?.import()} />
      <ActionRow label={t('setting_backup_part_export_list')} onPress={() => listImportExportRef.current?.export()} />
      <ListImportExport ref={listImportExportRef} />
    </SettingSection>
  )
})

const styles = createStyle({
  desc: {
    ...FORM_ROW_PADDING,
    paddingBottom: 4,
    // 行组件 minHeight 44 的对位：说明行按内容自高，仅保底部呼吸
  },
})
