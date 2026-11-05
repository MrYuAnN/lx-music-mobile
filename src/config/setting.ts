import { storageDataPrefix, storageDataPrefixOld } from '@/config/constant'
import defaultSetting from '@/config/defaultSetting'
import { getData, removeData, saveData } from '@/plugins/storage'
import migrateSetting, { migrateDesktopLyricStyle, migrateLovePicCustom } from './migrateSetting'
import settingState from '@/store/setting/state'
import { migrateMetaData, migrateListData } from './migrate'
import { exitApp, tipDialog } from '@/utils/tools'

// 业务相关工具方法


const primitiveType = ['string', 'boolean', 'number']
const checkPrimitiveType = (val: any): boolean => val === null || primitiveType.includes(typeof val)

// 语义版本比较（v 是否早于 target；无 version 的极老存储视为最老）
const isVersionBefore = (v: string | undefined, target: string): boolean => {
  if (v == null) return true
  const a = v.split('.').map(Number)
  const b = target.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}

// 存量升级迁移（版本跃迁钩子，2026-11-05）：updateSetting 每次启动把落盘 version 刷写为
// 当前默认版本，故存储 version 早于默认 version 即「跨版本升级首次启动」——一次性迁移项
// 按版本序排队挂这里；幂等性由 updateSetting 的 version 刷写保证（迁移后落盘即新版本，
// 下次启动不再触发）。只对持久化数据就地改值，后续 mergeSetting/updateSetting 走常规合并落盘
const migrateSettingAcrossVersions = (setting: Partial<SY.AppSetting>): void => {
  // v2.0 → 2.1 搜索默认打开（f890c384 的存量语义补全：全量落盘模式下旧默认 false 已持久化、
  // 会盖住新默认值，此处一次性升级；主动关闭过的用户同样被打开一次，可在设置页关回）
  if (isVersionBefore(setting.version, '2.1')) {
    if (setting['search.isShowHotSearch'] === false) setting['search.isShowHotSearch'] = true
    if (setting['search.isShowHistorySearch'] === false) setting['search.isShowHistorySearch'] = true
  }
  // v2.1 → 2.2 拖拽歌词调整进度默认开启（2026-11-05 弹窗重构批拍板：设置项自播放页更多弹层
  // 迁设置页歌词组 + 默认值 false→true；存量升级语义同上）
  if (isVersionBefore(setting.version, '2.2')) {
    if (setting['playDetail.isShowLyricProgressSetting'] === false) setting['playDetail.isShowLyricProgressSetting'] = true
  }
}

const mergeSetting = (originSetting: SY.AppSetting, targetSetting?: Partial<SY.AppSetting> | null): {
  setting: SY.AppSetting
  updatedSettingKeys: Array<keyof SY.AppSetting>
  updatedSetting: Partial<SY.AppSetting>
} => {
  let originSettingCopy: SY.AppSetting = { ...originSetting }
  // const defaultVersion = targetSettingCopy.version
  const updatedSettingKeys: Array<keyof SY.AppSetting> = []
  const updatedSetting: Partial<SY.AppSetting> = {}

  if (targetSetting) {
    const originSettingKeys = Object.keys(originSettingCopy)
    const targetSettingKeys = Object.keys(targetSetting)

    if (originSettingKeys.length > targetSettingKeys.length) {
      for (const key of targetSettingKeys as Array<keyof SY.AppSetting>) {
        const targetValue: any = targetSetting[key]
        const isPrimitive = checkPrimitiveType(targetValue)
        // if (checkPrimitiveType(value)) {
        if (!isPrimitive || targetValue == originSettingCopy[key] || originSettingCopy[key] === undefined) continue
        updatedSettingKeys.push(key)
        updatedSetting[key] = targetValue
        // @ts-expect-error
        originSettingCopy[key] = targetValue
        // } else {
        //   if (!isPrimitive && currentValue != undefined) handleMergeSetting(value, currentValue)
        // }
      }
    } else {
      for (const key of originSettingKeys as Array<keyof SY.AppSetting>) {
        const targetValue: any = targetSetting[key]
        const isPrimitive = checkPrimitiveType(targetValue)
        // if (checkPrimitiveType(value)) {
        if (!isPrimitive || targetValue == originSettingCopy[key]) continue
        updatedSettingKeys.push(key)
        updatedSetting[key] = targetValue
        // @ts-expect-error
        originSettingCopy[key] = targetValue
        // } else {
        //   if (!isPrimitive && currentValue != undefined) handleMergeSetting(value, currentValue)
        // }
      }
    }
  }

  return {
    setting: originSettingCopy,
    updatedSettingKeys,
    updatedSetting,
  }
}
export const updateSetting = (setting?: Partial<SY.AppSetting> | null, isInit: boolean = false) => {
  let originSetting: SY.AppSetting
  if (isInit) {
    originSetting = { ...defaultSetting }
  } else originSetting = settingState.setting

  const result = mergeSetting(originSetting, setting)

  result.setting.version = defaultSetting.version

  return result
}

export const initSetting = async() => {
  let setting: Partial<SY.AppSetting> | null = await getData(storageDataPrefix.setting)


  // try migrate setting before v1
  if (!setting) {
    const config = await getData<{ setting?: any }>(storageDataPrefixOld.setting)
    if (config != null) {
      setting = migrateSetting(config)
      try {
        await migrateListData()
        await migrateMetaData()
      } catch (err: any) {
        void tipDialog({
          title: '数据迁移失败 (Failed to migrate data)',
          message: `请截图并在 GitHub 反馈。为了防止数据丢失，应用将停止运行。错误信息：\n${(err.stack ?? err.message) as string}`,
          btnText: 'Exit',
          bgClose: false,
        }).then(() => {
          exitApp()
        })
        throw err
      }
      await removeData(storageDataPrefixOld.setting)
    }
  }

  // console.log(setting)
  // 存量升级迁移（版本跃迁）须在合并默认值【前】对原始持久化数据改值，与 LOVE 冻结位同位次
  if (setting != null) migrateSettingAcrossVersions(setting)
  // 「我喜欢」封面存量补标自定义冻结位（LOVE 纳入自动轨批）：须在合并默认值【前】对原始持久化
  // 数据判键（缺键=旧版手选，见 migrateSetting 注释；三席代码审查 C-1）
  migrateLovePicCustom(setting)
  const updatedSetting = updateSetting(setting, true)
  // 悬浮歌词颜色重置（存量 v2 用户，见 migrateSetting 注释）须在合并默认值后、落盘前执行
  migrateDesktopLyricStyle(updatedSetting.setting)
  void saveData(storageDataPrefix.setting, updatedSetting.setting)

  return updatedSetting
}
