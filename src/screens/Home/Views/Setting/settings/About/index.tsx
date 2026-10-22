import { memo, useState, useEffect } from 'react'
import { View } from 'react-native'

import SettingSection from '../../components/SettingSection'
import ActionRow from '../../components/ActionRow'
import Text, { FontFamilies } from '@/components/common/Text'
import { sizeFormate } from '@/utils'
import { createStyle, openUrl } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import { checkUpdate } from '@/core/version'
import { SPACING } from '@/config/spacing'

const currentVer = process.versions.app

// 关于节（治理批 P14 定稿：品牌区（App 名+版本）+ 检查更新动作行（副文本实时反馈状态机，
// 点击=直接 checkUpdate——发现新版自动弹 VersionModal 完成下载/安装闭环）+ 开源地址/常见问题
// 两行链接（对标主流关于页信息链接惯例，FAQ 为自定义源问题唯一 app 内出口）+ 上游致谢小字。
// 上游 lx-music 十段防骗声明文案随个人 fork 语境删除）
export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const progress = useVersionDownloadProgressUpdated()
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    if (versionInfo.isLatest) {
      setStatusText(t('version_tip_latest'))
    } else if (versionInfo.isUnknown) {
      setStatusText(t('version_tip_unknown'))
    } else {
      switch (versionInfo.status) {
        case 'downloading':
          setStatusText(t('version_btn_downloading', {
            total: sizeFormate(progress.total),
            current: sizeFormate(progress.current),
            progress: progress.total == 0 ? 0 : Math.floor((progress.current / progress.total) * 100),
          }))
          break
        case 'downloaded':
          setStatusText(t('version_tip_downloaded'))
          break
        case 'checking':
          setStatusText(t('version_tip_checking'))
          break
        case 'error':
          setStatusText(t('version_tip_failed'))
          break
        default:
          setStatusText(t('version_title_new'))
          break
      }
    }
  }, [t, versionInfo, progress])

  return (
    <SettingSection title={t('setting_about')}>
      <View style={styles.brand}>
        <Text style={styles.brandName} size={20} color={theme['c-font']}>{t('about_app_name')}</Text>
        <Text size={12} color={theme['c-font-label']} style={styles.brandVer}>{currentVer}</Text>
        <Text size={11} color={theme['c-font-label']}>{t('about_credit')}</Text>
      </View>
      <ActionRow label={t('about_check_update')} value={statusText} onPress={() => { void checkUpdate() }} />
      <ActionRow label={t('about_link_repo')} onPress={() => { void openUrl('https://github.com/lyswhut/lx-music-mobile#readme') }} />
      <ActionRow label={t('about_link_faq')} onPress={() => { void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/faq') }} />
    </SettingSection>
  )
})

const styles = createStyle({
  brand: {
    alignItems: 'center',
    paddingTop: SPACING.s16,
    paddingBottom: SPACING.s10,
  },
  brandName: {
    fontFamily: FontFamilies.medium,
  },
  brandVer: {
    marginTop: SPACING.s2,
    marginBottom: SPACING.s4,
  },
})
