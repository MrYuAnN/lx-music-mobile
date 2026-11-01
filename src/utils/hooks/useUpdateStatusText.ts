import { useVersionInfo, useVersionInfoIgnoreVersionUpdated } from '@/store/version/hook'
import { useI18n } from '@/lang'

// 检查更新行 value（2026-11-01 定案#2 微信式，推翻批 R 状态文案派生）：新版本未忽略→
// 「新版本 vX.Y.Z」；检查中→检查文案；已最新/未知/空闲/失败→空（平时不显示版本号——
// 版本号归品牌头单点，失败态由 checkUpdate 内 toast 承担）；唯一消费方=竖屏根菜单关于组
// （横屏关于节同款接入），About 屏已随定案#1 退役
export const useUpdateStatusText = (): string => {
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const ignoreVersion = useVersionInfoIgnoreVersionUpdated()
  if (versionInfo.status == 'checking') return t('version_tip_checking')
  const newVersion = versionInfo.newVersion?.version
  if (newVersion && newVersion != ignoreVersion) {
    return t('version_row_new', { version: newVersion })
  }
  return ''
}

