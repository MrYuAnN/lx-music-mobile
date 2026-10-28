import { useMemo, useState, useEffect, memo } from 'react'
import { View, ScrollView } from 'react-native'

import { compareVer } from '@/utils'

import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { type VersionInfo } from '@/store/version/state'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useVersionInfo, useVersionInfoIgnoreVersionUpdated } from '@/store/version/hook'
import ModalContent from './ModalContent'
import { checkUpdate, downloadUpdate, hideModal, setIgnoreVersion } from '@/core/version'
import { SPACING } from '@/config/spacing'

const VersionItem = ({ version, desc }: VersionInfo) => {
  return (
    <View style={styles.versionItem}>
      <Text style={styles.label}>v{version}</Text>
      <Text selectable style={styles.desc}>{desc}</Text>
    </View>
  )
}

const Content = memo(({ title, newVersionInfo }: {
  title: string
  newVersionInfo: VersionInfo | null
}) => {
  const t = useI18n()

  const history = useMemo(() => {
    if (!newVersionInfo?.history) return []
    let arr = []
    for (const ver of newVersionInfo?.history) {
      if (compareVer(currentVer, ver.version) < 0) arr.push(ver)
    }
    return arr
  }, [newVersionInfo])

  return (
    <View style={styles.main}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>{t('version_label_latest_ver')}{newVersionInfo?.version}</Text>
        <Text style={styles.label}>{t('version_label_current_ver')}{currentVer}</Text>
        {
          newVersionInfo?.desc
            ? (
                <View>
                  <Text style={styles.label}>{t('version_label_change_log')}</Text>
                  <View style={{ paddingLeft: SPACING.s10, marginTop: SPACING.s6 }}>
                    <Text selectable style={styles.desc}>{newVersionInfo.desc}</Text>
                  </View>
                </View>
              )
            : null
        }
        {
          history.length
            ? (
                <View style={styles.history}>
                  <Text style={styles.label}>{t('version_label_history')}</Text>
                  <View style={{ paddingLeft: SPACING.s10, marginTop: SPACING.s6 }}>
                    {history.map((item, index) => <VersionItem key={index} version={item.version} desc={item.desc} />)}
                  </View>
                </View>
              )
            : null
        }
      </ScrollView>
    </View>
  )
})

const currentVer = process.versions.app
// N1：RNN overlay → 根部 RN Modal（ModalHosts 挂载），componentId 随之退役
const VersionModal = () => {
  const theme = useTheme()
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const ignoreVersion = useVersionInfoIgnoreVersionUpdated()
  const [ignoreBtn, setIgnoreBtn] = useState({ text: t('version_btn_ignore'), show: true, disabled: false })
  const [closeBtnText, setCloseBtnText] = useState(t('version_btn_close'))
  const [confirmBtn, setConfirmBtn] = useState({ text: '', show: true, disabled: false })
  const [title, setTitle] = useState('')
  const [tip, setTip] = useState('')


  useEffect(() => {
    let ignoreBtnConfig = { ...ignoreBtn }
    if (versionInfo.isLatest) {
      setTitle(t('version_title_latest'))
      setTip('')
      ignoreBtnConfig.show = false
      setConfirmBtn({ text: t('version_btn_new'), show: false, disabled: true })
      setCloseBtnText(t('version_btn_close'))
    } else if (versionInfo.isUnknown) {
      setTitle(t('version_title_unknown'))
      setTip(t('version_tip_unknown'))
      ignoreBtnConfig.show = false
      setConfirmBtn({ text: t('version_btn_failed'), show: true, disabled: false })
      setCloseBtnText(t('version_btn_close'))
    } else {
      switch (versionInfo.status) {
        case 'checking':
          setTitle(t('version_title_checking'))
          setTip('')
          ignoreBtnConfig.show = false
          setConfirmBtn({ text: t('version_btn_new'), show: false, disabled: true })
          setCloseBtnText(t('version_btn_close'))
          break
        case 'error':
          setTitle(t('version_title_failed'))
          setTip(t('version_tip_failed'))
          ignoreBtnConfig.show = true
          ignoreBtnConfig.disabled = false
          setConfirmBtn({ text: t('version_btn_failed'), show: true, disabled: false })
          setCloseBtnText(t('version_btn_close'))
          break
        // case 'idle':
        //   break
        default:
          setTitle(t('version_title_new'))
          setTip('')
          ignoreBtnConfig.show = true
          ignoreBtnConfig.disabled = false
          // 升级=跳浏览器下载（批1 阶段4）：按钮即触发 openUrl
          setConfirmBtn({ text: t('version_btn_browser_update'), show: true, disabled: false })
          setCloseBtnText(t('version_btn_close'))
          break
      }
    }
    ignoreBtnConfig.text = t(ignoreVersion == versionInfo.newVersion?.version ? 'version_btn_ignore_cancel' : 'version_btn_ignore')
    setIgnoreBtn(ignoreBtnConfig)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, versionInfo, ignoreVersion])

  const handleCancel = () => {
    hideModal()
  }
  const handleIgnore = () => {
    setIgnoreVersion(ignoreVersion != versionInfo.newVersion!.version ? versionInfo.newVersion!.version : null)
    // handleCancel()
  }

  const handleConfirm = () => {
    if (versionInfo.isLatest || versionInfo.isUnknown) {
      void checkUpdate()
    } else {
      downloadUpdate() // 跳浏览器下载升级包（批1 阶段4）
    }
  }

  return (
    <ModalContent>
      <Content title={title} newVersionInfo={versionInfo.newVersion} />
      { tip.length ? <Text style={styles.tip} color={theme['c-primary-font']}>{tip}</Text> : null }
      <View style={styles.btns}>
        {
          ignoreBtn.show
            ? (
                <Button disabled={ignoreBtn.disabled} style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleIgnore}>
                  <Text color={theme['c-button-font']}>{ignoreBtn.text}</Text>
                </Button>
              )
            : null
        }
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleCancel}>
          <Text color={theme['c-button-font']}>{closeBtnText}</Text>
        </Button>
        {
          confirmBtn.show
            ? (
                <Button disabled={confirmBtn.disabled} style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleConfirm}>
                  <Text color={theme['c-button-font']}>{confirmBtn.text}</Text>
                </Button>
              )
            : null
        }
      </View>
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    // flexGrow: 0,
    flexShrink: 1,
    marginTop: SPACING.s16,
    marginLeft: SPACING.s16,
    marginRight: SPACING.s16,
    marginBottom: SPACING.s20,
  },
  content: {
    flexGrow: 0,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: SPACING.s16,
  },
  history: {
    marginTop: SPACING.s16,
  },
  versionItem: {
    marginBottom: SPACING.s10,
  },
  label: {
    fontSize: 14,
    marginBottom: SPACING.s2,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
  tip: {
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingBottom: SPACING.s10,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: SPACING.s16,
    paddingLeft: SPACING.s16,
    // paddingRight: 15,
  },
  btn: {
    flex: 1,
    paddingTop: SPACING.s10,
    paddingBottom: SPACING.s10,
    paddingLeft: SPACING.s10,
    paddingRight: SPACING.s10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: SPACING.s16,
  },
})

export default VersionModal

