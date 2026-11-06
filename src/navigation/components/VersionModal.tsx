import { useEffect } from 'react'
import { Image, ScrollView, View } from 'react-native'

import Button from '@/components/common/Button'
import ChangelogNote from '@/components/common/ChangelogNote'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text, { FontFamilies } from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useVersionInfo, useVersionInfoIgnoreVersionUpdated, useVersionModalVisible } from '@/store/version/hook'
import ModalContent from './ModalContent'
import { downloadUpdate, hideModal, setIgnoreVersion } from '@/core/version'
import { SPACING } from '@/config/spacing'

// What's New 卡式重做（2026-11-06 方案 v3，审查包 .review-bundle/2026-11-06-update-modal-plan）：
// 单形态「发现新版」弹窗——多态死分支收编（checking/error/latest 由手动入口 toast+状态行
// 承担，2026-11-01 定案#2；弹窗挂载仍由 store showModal 驱动，ModalHosts 不动，此处空守卫
// 仅防御渲染）；版式对标 App Store What's New 卡：icon+标题+版本副行头部、最新版 desc 走
// ChangelogNote（D5 三端同规则拍板）限高滚动（无「更新说明」小节标题行，I-R3）、tip 行、
// 双钮主次（InputSheet 先例：次钮 c-button-background+主钮 c-primary 实底，numberOfLines=1
// 防长文案折行截断）；忽略降级小字链接（点忽略不关窗原地 toggle——取消忽略可达性依赖弹窗
// 保持打开；history 区退役，累积变更归更新日志页）。
const appIcon = require('@/resources/images/app-icon.png')

const currentVer = process.versions.app

const VersionModal = () => {
  const theme = useTheme()
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const ignoreVersion = useVersionInfoIgnoreVersionUpdated()
  const modalVisible = useVersionModalVisible()
  const newVersion = versionInfo.newVersion
  const isIgnored = ignoreVersion != null && ignoreVersion == newVersion?.version

  // 防御联动（2026-11-06 代码审查 I-1 拍板）：Modal 壳由顶层 showModal 驱动、内容由
  // newVersion 驱动，二者源不同步（启动 auto 检查在飞 + 手动并发、两查结果 404/200 分歧
  // 的窄缝）会产出透明悬挂 Modal（挡输入且无按钮）——检测到即复位，壳与内容同生同灭
  useEffect(() => {
    if (!newVersion && modalVisible) hideModal()
  }, [newVersion, modalVisible])

  // 空守卫前置（审查 S-2）：守卫后 TS 控制流自然收窄，下方 handler 免非空断言
  if (!newVersion) return null

  const handleLater = () => {
    hideModal()
  }
  const handleUpgrade = () => {
    downloadUpdate() // 跳浏览器下载升级包（批1 阶段4）
    hideModal() // 升级动作结束弹窗生命周期（审查 S-6 拍板，微信/App Store 同款；标记已写不会立刻重弹）
  }
  const handleIgnore = () => {
    setIgnoreVersion(isIgnored ? null : newVersion.version)
  }

  return (
    <ModalContent>
      <View style={styles.main}>
        <View style={styles.header}>
          <Image source={appIcon} style={styles.icon} />
          <View style={styles.headerTexts}>
            <Text size={17} style={styles.title}>{t('version_title_new')}</Text>
            <Text size={13} numberOfLines={1} color={theme['c-font-label']}>{t('version_row_versions', { latest: newVersion.version, current: currentVer })}</Text>
          </View>
        </View>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'} showsVerticalScrollIndicator={false}>
          <ChangelogNote note={newVersion.desc} />
        </ScrollView>
        <Text size={13} color={theme['c-font-label']} style={styles.tip}>{t('version_tip_browser_download')}</Text>
        <View style={styles.btns}>
          <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleLater}>
            <Text size={14} numberOfLines={1} color={theme['c-font']}>{t('version_btn_later')}</Text>
          </Button>
          <Button style={{ ...styles.btn, backgroundColor: theme['c-primary'] }} onPress={handleUpgrade}>
            <Text size={14} numberOfLines={1} style={styles.confirmText} color={theme['c-on-primary']}>{t('version_btn_upgrade')}</Text>
          </Button>
        </View>
        <Button style={styles.ignoreBtn} onPress={handleIgnore}>
          <Text size={13} color={theme['c-font-label']}>{t(isIgnored ? 'version_btn_ignore_cancel' : 'version_btn_ignore')}</Text>
        </Button>
      </View>
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: SPACING.s16,
    marginLeft: SPACING.s16,
    marginRight: SPACING.s16,
    marginBottom: SPACING.s16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
    marginBottom: SPACING.s12,
  },
  icon: {
    width: 48, // Android 标准图标栅格单元（方案 §二.1）
    height: 48,
    borderRadius: 12, // 组卡圆角档（2026-10-23 拍板 #7）
  },
  headerTexts: {
    flexShrink: 1,
    gap: SPACING.s2,
  },
  title: {
    fontFamily: FontFamilies.semibold,
  },
  content: {
    flexGrow: 0,
    // changelog 限高（防御长内容；弹窗 maxHeight 78% 内自适应，短内容随内容收缩）
    maxHeight: 240,
  },
  tip: {
    textAlign: 'center',
    marginTop: SPACING.s12,
    marginBottom: SPACING.s12,
  },
  btns: {
    flexDirection: 'row',
    gap: SPACING.s12,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.s12,
    paddingBottom: SPACING.s12,
    borderRadius: 8, // 圆角档（2/4/8/12/16/999）
  },
  confirmText: {
    fontFamily: FontFamilies.semibold,
  },
  ignoreBtn: {
    alignItems: 'center',
    // s10：小字链接也要保 44pt 级触控高度（审查 S-5，HIG 最小触点）
    paddingTop: SPACING.s10,
    paddingBottom: SPACING.s10,
    // 触点超出按钮行底部时留出呼吸（视觉间距由 marginTop 承担，非 padding，保证触区不缩水）
    marginTop: SPACING.s2,
  },
})

export default VersionModal
