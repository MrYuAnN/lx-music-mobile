import { useEffect } from 'react'
import { BackHandler } from 'react-native'

export function useBackHandler(handler: () => boolean) {
  useEffect(() => {
    // N2：RN 0.86 移除 BackHandler.removeEventListener，用 addEventListener 返回的 subscription
    const sub = BackHandler.addEventListener('hardwareBackPress', handler)

    return () => {
      sub.remove()
    }
  }, [handler])
}
