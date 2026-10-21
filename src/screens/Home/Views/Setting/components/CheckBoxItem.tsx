// ⚠️ 退役过渡组件（2026-10-21 设置页重构拍板）：非冻结区已清退，仅剩桌面歌词冻结区与
// 五节过渡态在册引用（同步/备份/源管理/缓存与日志/DislikeList 内部），待悬浮歌词批完成后的
// 二次退役批统一删除并清引用——新代码禁止引用本组件（用 SwitchRow/SelectRow/SettingSection）
import { memo } from 'react'

import { View } from 'react-native'

import CheckBox, { type CheckBoxProps } from '@/components/common/CheckBox'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

export default memo((props: CheckBoxProps) => {
  return (
    <View style={styles.container}>
      <CheckBox {...props} />
    </View>
  )
})

const styles = createStyle({
  container: {
    paddingLeft: SPACING.s26,
    // marginTop: -10,
    // marginBottom: 0,
  },
})

