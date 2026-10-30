import { useEffect, useState } from 'react'
import state from './state'

export const useSetting = () => {
  const [setting, updateSetting] = useState(state.setting)

  useEffect(() => {
    const handleUpdate = () => {
      updateSetting(state.setting)
    }
    global.state_event.on('configUpdated', handleUpdate)
    return () => {
      global.state_event.off('configUpdated', handleUpdate)
    }
  }, [])

  return setting
}

export const useSettingValue = <T extends keyof SY.AppSetting>(key: T): SY.AppSetting[T] => {
  const [value, update] = useState(state.setting[key])

  useEffect(() => {
    const handleUpdate = (keys: Array<keyof SY.AppSetting>) => {
      if (!keys.includes(key)) return
      update(state.setting[key])
    }
    global.state_event.on('configUpdated', handleUpdate)
    return () => {
      global.state_event.off('configUpdated', handleUpdate)
    }
  }, [key])

  return value
}
