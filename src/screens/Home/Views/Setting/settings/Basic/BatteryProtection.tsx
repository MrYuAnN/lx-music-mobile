import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import ActionRow from '../../components/ActionRow'
import { isIgnoringBatteryOptimization, requestIgnoreBatteryOptimization } from '@/utils/nativeModules/utils'
import { useI18n } from '@/lang/i18n'

// 后台播放保护行（2026-11-04 ⑤拍板：电池优化打扰式弹窗退役后的常驻自助入口，对标
// 网易云/QQ音乐设置页「后台播放保护」节做法——产品席已实核网易云设置内同构节）：
// 未加白名单=值位「去设置」整行点击发起系统白名单请求；已加=值位「已开启」无动作。
// 刷新双通道：返回前台 AppState 重查（系统设置页路径，NotificationPermission 同款）+
// 点击后独立延迟重查（代码审查 I-2：原生 wrapper result=true 不 resolve、等 AppState
// 收尾，而系统确认框是应用内浮层不触发 AppState——promise 值不可依赖，延迟查兜回填）
export default memo(() => {
  const t = useI18n()
  const [enabled, setEnabled] = useState(true)
  // 卸载守卫（MyKeys mounted 同款模式；优化师 S-2：异步回填前查 mounted）
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const check = useCallback(() => {
    void isIgnoringBatteryOptimization().then(result => {
      if (mounted.current) setEnabled(result)
    })
  }, [])

  useEffect(() => {
    check()
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check()
    })
    return () => { sub.remove() }
  }, [check])

  return (
    <ActionRow
      label={t('setting_battery_protection')}
      value={enabled ? t('setting_battery_protection_on') : t('dialog_go_settings')}
      onPress={enabled
        ? undefined
        : () => {
            void requestIgnoreBatteryOptimization()
            setTimeout(check, 1500)
          }}
    />
  )
})
