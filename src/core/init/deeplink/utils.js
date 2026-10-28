import { tipDialog } from '@/utils/tools'
// 直连化（批1 阶段2）：源集与音质档改由 /config 下发集派生（摘源即拒，防深链直达已摘除源）
import { getShiyinSources } from '@/core/shiyin/config'

export const errorDialog = message => {
  tipDialog({
    message: `${global.i18n.t('deep_link__handle_error_tip', { message })}`,
    btnText: global.i18n.t('ok'),
  })
}
export const sourceVerify = source => {
  if (!(source in getShiyinSources())) throw new Error('Source no match')
}

export const qualityFilter = (source, types) => {
  const qualitys = getShiyinSources()[source]?.qualitys ?? []
  types = types.filter(({ type }) => qualitys.includes(type)).map(({ type, size, hash }) => {
    if (size != null && typeof size != 'string') throw new Error(type + ' size type no match')
    if (source == 'kg' && typeof hash != 'string') throw new Error(type + ' hash type no match')
    return hash == null ? { type, size } : { type, size, hash }
  })
  if (!types.length) throw new Error('quality no match')
  return types
}

export const dataVerify = (rules, data) => {
  const newData = {}
  for (const rule of rules) {
    const val = data[rule.key]
    if (rule.required && val == null) throw new Error(rule.key + ' missing')
    if (val != null) {
      if (rule.types && !rule.types.includes(typeof val)) throw new Error(rule.key + ' type no match')
      if (rule.max && String(val).length > rule.max) throw new Error(rule.key + ' max length no match')
      if (rule.min && String(val).length > rule.min) throw new Error(rule.key + ' min length no match')
    }
    newData[rule.key] = val
  }
  return newData
}
