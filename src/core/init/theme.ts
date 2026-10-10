
import { getAppearance, getIsSupportedAutoTheme, onAppearanceChange } from '@/utils/tools'
import { setShouldUseDarkColors, applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes/index'
import themeState from '@/store/theme/state'
import StatusBar from '@/components/common/StatusBar'


export default async() => {
  if (getIsSupportedAutoTheme()) {
    setShouldUseDarkColors(getAppearance() == 'dark')

    // AM 化：theme.id 为 auto（或旧版遗留 id）时跟随系统；显式选了 am_light/am_dark
    // 时 getTheme 返回值不变，applyTheme 的幂等守卫会跳过
    onAppearanceChange(color => {
      setShouldUseDarkColors((color ?? 'light') == 'dark')
      const theme = getTheme()
      if (theme.id != themeState.theme.id) applyTheme(theme)
    })
  }

  applyTheme(getTheme())

  global.state_event.on('themeUpdated', (theme) => {
    StatusBar.setBarStyle(theme.isDark ? 'light-content' : 'dark-content')
  })
}
