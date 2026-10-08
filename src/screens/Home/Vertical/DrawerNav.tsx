import { memo, useRef } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { useI18n, type Message } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { exitApp } from '@/core/common'
import Text from '@/components/common/Text'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { useSettingValue } from '@/store/setting/hook'

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 16,
  },
  menus: {
    flex: 1,
  },
  list: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 25,
    paddingRight: 25,
    alignItems: 'center',
  },
  iconContent: {
    width: 24,
    alignItems: 'center',
  },
  text: {
    paddingLeft: 20,
  },
  separator: {
    height: 0.6,
    marginLeft: 25,
    marginRight: 25,
    marginBottom: 8,
  },
})

const Header = () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View style={{ paddingTop: statusBarHeight, backgroundColor: theme['c-primary-light-700-alpha-500'] }}>
      <View style={styles.header}>
        <Icon name="logo" color={theme['c-primary-dark-100-alpha-300']} size={28} />
        <Text style={styles.headerText} size={28} color={theme['c-primary-dark-100-alpha-300']}>LX Music</Text>
      </View>
    </View>
  )
}

// 抽屉定位为功能菜单（对齐 MusicFree）：设置 / 定时关闭 / 备份与恢复 / 关于，内容导航入口由首页承载
type MenuId = 'setting' | 'timeout_exit' | 'backup' | 'about' | 'back_home' | 'exit'

const MenuItem = ({ icon, label, color, onPress }: {
  icon: string
  label: string
  color?: string
  onPress: () => void
}) => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.iconContent}>
        <Icon name={icon} size={20} color={color ?? theme['c-font-label']} />
      </View>
      <Text style={styles.text} color={color}>{label}</Text>
    </TouchableOpacity>
  )
}

const MENUS: Array<{ id: MenuId, icon: string, labelKey: keyof Message }> = [
  { id: 'setting', icon: 'setting', labelKey: 'nav_setting' },
  { id: 'timeout_exit', icon: 'music_time', labelKey: 'nav_timeout_exit' },
  { id: 'backup', icon: 'sd-card', labelKey: 'setting_backup' },
  { id: 'about', icon: 'help', labelKey: 'nav_about' },
]

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')
  const modalRef = useRef<TimeoutExitEditModalType>(null)
  const timeInfo = useTimeInfo()

  const pushSetting = (initialAnchor?: 'backup' | 'about') => {
    const componentId = commonState.componentIds.home
    if (!componentId) return
    navigations.pushSettingScreen(componentId, initialAnchor)
  }

  const handleMenu = (id: MenuId) => {
    if (id == 'back_home') {
      backHome()
      return
    }
    if (id == 'exit') {
      void confirmDialog({
        message: global.i18n.t('exit_app_tip'),
        confirmButtonText: global.i18n.t('list_remove_tip_button'),
      }).then(isExit => {
        if (!isExit) return
        exitApp('Exit Btn')
      })
      return
    }

    global.app_event.changeMenuVisible(false)
    if (id == 'timeout_exit') {
      modalRef.current?.show()
      return
    }
    // setting / backup / about：均进设置屏，后两者锚定到对应分组
    pushSetting(id == 'setting' ? undefined : id)
  }


  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      <Header />
      <ScrollView style={styles.menus}>
        <View style={styles.list}>
          {
            MENUS.map(menu => (
              <MenuItem
                key={menu.id}
                icon={menu.icon}
                label={t(menu.labelKey)}
                onPress={() => { handleMenu(menu.id) }}
              />
            ))
          }
        </View>
      </ScrollView>

      {
        showBackBtn ? <MenuItem icon="home" label={t('back_home')} onPress={() => { handleMenu('back_home') }} /> : null
      }
      {
        showExitBtn ? (
          <>
            <View style={{ ...styles.separator, backgroundColor: theme['c-border-background'] }} />
            <MenuItem icon="exit2" label={t('nav_exit')} color="#e0544b" onPress={() => { handleMenu('exit') }} />
          </>
        ) : null
      }
      <TimeoutExitEditModal ref={modalRef} timeInfo={timeInfo} />
    </View>
  )
})
