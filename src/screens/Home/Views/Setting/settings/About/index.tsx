import { memo, useState, useEffect } from 'react'
import { View, TouchableOpacity } from 'react-native'

import SettingSection from '../../components/SettingSection'
import Button from '../../components/Button'
import { sizeFormate } from '@/utils'
import { createStyle, openUrl } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text, { FontFamilies } from '@/components/common/Text'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import { showModal } from '@/core/version'
import { FORM_ROW_PADDING } from '@/config/form'
import { SPACING } from '@/config/spacing'

const currentVer = process.versions.app

const openHomePage = () => {
  void openUrl('https://github.com/lyswhut/lx-music-mobile#readme')
}
const openIssuePage = () => {
  void openUrl('https://github.com/lyswhut/lx-music-mobile/issues?q=is%3Aissue+')
}
const openGHReleasePage = () => {
  void openUrl('https://github.com/lyswhut/lx-music-mobile/releases')
}
const openFAQPage = () => {
  void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/faq')
}

// 关于节（2026-10-21 设置页重构：版本节并入——Version 六态状态机收编为卡内
// 版本信息行+动态状态行+检查更新按钮，正文说明保留；正文硬编码中文为已知现状不动）
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
          setStatusText(t('version_title_update'))
          break
        case 'checking':
          setStatusText(t('version_title_checking'))
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

  const textLinkStyle = {
    ...styles.text,
    textDecorationLine: 'underline',
    color: theme['c-primary-font'],
  } as const

  return (
    <SettingSection title={t('setting_about')}>
      <View style={styles.row}>
        <Text style={styles.label}>{t('version_label_current_ver')}</Text>
        <Text style={styles.value}>{currentVer}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('version_label_latest_ver')}</Text>
        <Text style={styles.value}>{versionInfo.newVersion?.version ?? '--'}</Text>
      </View>
      {
        statusText
          ? (
              <View style={styles.row}>
                <Text size={13} color={theme['c-font-label']}>{statusText}</Text>
              </View>
            )
          : null
      }
      <View style={styles.row}>
        <Button onPress={() => { showModal() }}>{t('setting_version_show_ver_modal')}</Button>
      </View>
      <View style={styles.part}>
        <Text style={styles.text} >本软件完全免费，代码已开源。开源地址：</Text>
        <TouchableOpacity onPress={openHomePage}>
          <Text style={textLinkStyle}>https://github.com/lyswhut/lx-music-mobile</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>最新版下载地址：</Text>
        <TouchableOpacity onPress={openGHReleasePage}>
          <Text style={textLinkStyle}>GitHub Releases</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.part}>
        <Text style={styles.text} >软件的常见问题可转至：</Text>
        <TouchableOpacity onPress={openFAQPage}>
          <Text style={textLinkStyle}>移动版常见问题</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}><Text style={styles.boldText}>本软件没有客服</Text>，但我们整理了一些常见的使用问题。<Text style={styles.boldText} >仔细、仔细、仔细</Text>地阅读常见问题后，</Text>
        <Text style={styles.text}>仍有问题可到 GitHub </Text>
        <TouchableOpacity onPress={openIssuePage}>
          <Text style={textLinkStyle}>提交 Issue</Text>
        </TouchableOpacity>
        <Text style={styles.text}>。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>由于软件开发的初衷仅是为了对新技术的学习与研究，因此软件直至停止维护都将会一直保持纯净。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>目前本项目的原始发布地址<Text style={styles.boldText}>只有 GitHub</Text>，其他渠道均为第三方转载发布，可信度请自行鉴别。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}><Text style={styles.boldText}>本项目没有微信公众号之类的所谓「官方账号」，也未在小米、华为、vivo 等应用商店发布同名应用，谨防被骗！</Text></Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>若你使用过程中遇到<Text style={styles.boldText}>广告</Text>或者<Text style={styles.boldText}>引流</Text>（如需要加群、关注公众号之类才能使用或者升级）的信息，则表明你当前运行的软件是「第三方修改版」。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>若在升级新版本时提示「<Text style={styles.boldText}>签名不一致</Text>」，则表明你手机上的旧版本或者将要安装的新版本中<Text style={styles.boldText}>有一方</Text>是「<Text style={styles.boldText}>第三方修改版</Text>」。</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>By: </Text>
        <Text style={styles.text}>落雪无痕</Text>
      </View>
    </SettingSection>
  )
})

const styles = createStyle({
  row: {
    ...FORM_ROW_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: SPACING.s12,
  },
  value: {
    flexShrink: 1,
  },
  part: {
    marginLeft: SPACING.s16,
    marginRight: SPACING.s16,
    marginBottom: SPACING.s10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 14,
    textAlignVertical: 'bottom',
  },
  boldText: {
    fontSize: 14,
    fontFamily: FontFamilies.bold,
    textAlignVertical: 'bottom',
  },
})
