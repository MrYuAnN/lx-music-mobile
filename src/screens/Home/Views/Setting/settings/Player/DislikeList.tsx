import { memo, useCallback } from 'react'

import SelectRow from '../../components/SelectRow'
import { useRuleNum } from '@/store/dislikeList/hook'
import { useI18n } from '@/lang'
import { pushScreen } from '@/navigation'
import { DISLIKE_MANAGE_SCREEN } from '@/navigation/screenNames'

// 黑名单入口（治理批 P5：旧「不喜欢的歌曲规则」textarea 编辑退役，改独立管理页跳转，
// 对标 QQ音乐「黑名单设置」；UI 命名「黑名单」，内部 dislike 协议与存储格式不动）
export default memo(() => {
  const t = useI18n()
  const ruleNum = useRuleNum()

  const handlePress = useCallback(() => {
    pushScreen(DISLIKE_MANAGE_SCREEN)
  }, [])

  return <SelectRow label={t('dislike_setting_entry')} value={t('dislike_rule_num', { num: ruleNum })} onPress={handlePress} />
})
