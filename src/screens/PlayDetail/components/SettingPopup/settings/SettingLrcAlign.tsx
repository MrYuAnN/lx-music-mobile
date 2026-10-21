import { useMemo } from 'react'

import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import CategoryChips from '@/components/common/CategoryChips'
import Card from './Card'
import styles from './style'

type Align_Type = LX.AppSetting['playDetail.style.align']

const ALIGN_LIST = [
  'left',
  'center',
  'right',
] as const

// 歌词对齐行卡（2026-10-20 更多弹层重构：三胶囊单选——与倍速统一胶囊选择语言，复用 CategoryChips）
export default () => {
  const t = useI18n()
  const align = useSettingValue('playDetail.style.align')

  const list = useMemo(() => {
    return ALIGN_LIST.map(id => ({ id, label: t(`play_detail_setting_lrc_align_${id}`) }))
  }, [t])

  const setPosition = (id: string) => {
    updateSetting({ 'playDetail.style.align': id as Align_Type })
  }

  return (
    <Card>
      <Text>{t('play_detail_setting_lrc_align')}</Text>
      <CategoryChips items={list} activeId={align} onChange={setPosition} style={styles.chips} />
    </Card>
  )
}
