import { memo, useCallback, useMemo, useRef, useState } from 'react'

import SettingSection from '../../components/SettingSection'
import SelectRow from '../../components/SelectRow'
import CheckSheet, { type CheckSheetType, type CheckSheetItem } from '@/components/common/CheckSheet'
import { setApiSource } from '@/core/apiSource'
import { useI18n } from '@/lang'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import UserApiEditModal, { type UserApiEditModalType } from './UserApiEditModal'

// 自定义源（2026-10-21 设置页重构现代化：复选框长列表收敛为「当前源值行+管理值行」，
// 切源走 CheckSheet，源状态并入 CheckSheet label——与全卡行语言统一）
const apiSourceList = apiSourceInfo.map(api => ({
  id: api.id,
  name: api.name,
  disabled: api.disabled,
}))

export default memo(() => {
  const t = useI18n()
  const sheetRef = useRef<CheckSheetType>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const modalRef = useRef<UserApiEditModalType>(null)
  const apiSourceSetting = useSettingValue('common.apiSource')
  const userApiListRaw = useUserApiList()
  const apiStatus = useStatus()

  const options = useMemo<readonly CheckSheetItem[]>(() => {
    const getApiStatus = () => {
      if (apiStatus.status) return t('setting_basic_source_status_success')
      if (apiStatus.message == 'initing') return t('setting_basic_source_status_initing')
      return t('setting_basic_source_status_failed')
    }
    const builtIn = apiSourceList.map(({ id }) => ({
      // @ts-expect-error
      action: id, label: t(`setting_basic_source_${id}`) || id,
    }))
    const userApis = userApiListRaw.map(api => ({
      action: api.id,
      label: api.id == apiSourceSetting ? `${api.name}[${getApiStatus()}]` : api.name,
    }))
    return [...builtIn, ...userApis]
  }, [t, userApiListRaw, apiStatus, apiSourceSetting])

  const currentSourceName = useMemo(() => {
    return options.find(o => o.action == apiSourceSetting)?.label ?? apiSourceSetting
  }, [options, apiSourceSetting])

  const showSheet = useCallback(() => {
    setSheetVisible(true)
    requestAnimationFrame(() => {
      sheetRef.current?.show()
    })
  }, [])

  const handleChange = useCallback((item: CheckSheetItem) => {
    setApiSource(item.action)
  }, [])

  const handleShowManage = useCallback(() => {
    modalRef.current?.show()
  }, [])

  const userApiCount = userApiListRaw.length

  return (
    <SettingSection title={t('setting_basic_source')}>
      <SelectRow
        label={t('setting_basic_source_title')}
        value={currentSourceName}
        onPress={showSheet}
      />
      <SelectRow
        label={t('setting_basic_source_user_api_btn')}
        value={userApiCount ? t('music_count', { count: userApiCount }) : ''}
        onPress={handleShowManage}
      />
      {
        sheetVisible
          ? (
              <CheckSheet
                ref={sheetRef}
                title={t('setting_basic_source_title')}
                options={options}
                value={apiSourceSetting}
                onPress={handleChange}
                onHide={() => { setSheetVisible(false) }}
              />
            )
          : null
      }
      <UserApiEditModal ref={modalRef} />
    </SettingSection>
  )
})
