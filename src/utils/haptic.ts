import ReactNativeHapticFeedback from 'react-native-haptic-feedback'

// AM 触感单点收口：selection 用于菜单/翻页等轻交互，impactLight 用于播控/长按等确认交互
const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
}

export const hapticSelection = () => {
  ReactNativeHapticFeedback.trigger('selection', options)
}

export const hapticImpactLight = () => {
  ReactNativeHapticFeedback.trigger('impactLight', options)
}
