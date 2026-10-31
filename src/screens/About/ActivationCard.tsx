// 激活管理卡片（批2 F；净屏 KeyInfoActivity 最小对齐面）：状态行+输码激活（剪贴板检测
// =净屏 detectClipboardCode 同规则——命中显示提示行、点击才填入，不静默预填，仅未购态；
// 审计 A-1 修正）+解绑本机（含月限事前告知文案）+在途防重（审计 A-3）。试用领取/重装
// 恢复在原生自动编排（净屏同款），无手动入口——「远程解绑他机/多码管理」划后续批
// （v3 定稿 F 表注记）。
import { memo, useCallback, useEffect, useState } from 'react'
import { Modal, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { BorderWidths } from '@/theme'
import { getGlassHairlineColor } from '@/components/common/GlassSurface'
import ActionRow from '@/screens/Home/Views/Setting/components/ActionRow'
import Clipboard from '@react-native-clipboard/clipboard'
import {
  formatActivationState,
  useActivationState,
  activateByCode,
  unbindDevice,
  detectClipboardCandidate,
} from '@/core/shiyin/activation'

const ActivationCard = () => {
  const theme = useTheme()
  const t = useI18n()
  const { info, refresh } = useActivationState()
  const [visible, setVisible] = useState(false)
  const [code, setCode] = useState('')
  const [clipCandidate, setClipCandidate] = useState<string | null>(null)
  // 在途防重（审计 A-3，净屏 submitting 三重锁对齐）：提交期禁两钮+弹窗不可关，
  // 防连点并发双请求（先成功后失败的混乱反馈）
  const [submitting, setSubmitting] = useState(false)

  // 剪贴板检测（净屏规则，审计 A-1）：仅未购态、命中显示提示行点击填入——不静默改输入框
  useEffect(() => {
    if (!visible) return
    setClipCandidate(null)
    if (info?.state != 'unactivated') return
    void Clipboard.getString().then(text => {
      setClipCandidate(detectClipboardCandidate(text))
    }).catch(() => {})
  }, [visible, info?.state])

  const handleActivate = useCallback(() => {
    if (submitting) return
    setSubmitting(true)
    void activateByCode(code, () => {
      setCode('')
      setVisible(false)
      refresh()
    }).finally(() => { setSubmitting(false) })
  }, [code, refresh, submitting])

  const handleUnbind = useCallback(() => {
    if (submitting) return
    setSubmitting(true)
    void unbindDevice(refresh).finally(() => { setSubmitting(false) })
  }, [refresh, submitting])

  const requestClose = useCallback(() => {
    if (!submitting) setVisible(false)
  }, [submitting])

  return (
    <>
      <ActionRow
        label={t('setting_activation')}
        value={formatActivationState(info, t)}
        onPress={() => { setVisible(true) }}
      />
      <Modal visible={visible} transparent animationType="fade" onRequestClose={requestClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={requestClose}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View
              style={[
                styles.dialog,
                {
                  backgroundColor: theme['c-content-background'],
                  borderColor: getGlassHairlineColor(theme.isDark),
                },
              ]}
            >
              <Text style={styles.title}>{t('setting_activation')}</Text>
              <Text style={styles.state} color={theme['c-font-label']}>
                {formatActivationState(info, t) || t('activation_state_unactivated')}
              </Text>
              <Input
                value={code}
                onChangeText={setCode}
                placeholder={t('activation_input_hint')}
                placeholderTextColor={theme['c-font-label']}
                style={{ ...styles.input, borderColor: getGlassHairlineColor(theme.isDark) }}
              />
              {clipCandidate && !code
                ? (
                  <TouchableOpacity style={styles.clipChip} onPress={() => { setCode(clipCandidate) }}>
                    <Text size={12} color={theme['c-primary-font']}>{t('activation_clip_chip')}</Text>
                  </TouchableOpacity>
                )
                : null}
              <View style={styles.btns}>
                {info?.state != 'unactivated'
                  ? (
                    <Button
                      style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }}
                      disabled={submitting}
                      onPress={handleUnbind}
                    >
                      <Text color={theme['c-button-font']}>{t('activation_btn_unbind')}</Text>
                    </Button>
                  )
                  : null}
                <Button
                  style={{ ...styles.btn, backgroundColor: theme['c-primary-background'] }}
                  disabled={submitting}
                  onPress={handleActivate}
                >
                  <Text color={theme['c-primary-font']}>
                    {submitting ? t('activation_activating') : t('activation_btn_activate')}
                  </Text>
                </Button>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = createStyle({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.s24,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialog: {
    borderRadius: 12,
    borderWidth: BorderWidths.normal,
    paddingTop: SPACING.s16,
    paddingBottom: SPACING.s16,
    paddingHorizontal: SPACING.s16,
  },
  title: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.s6,
  },
  state: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: SPACING.s12,
  },
  input: {
    borderWidth: BorderWidths.normal,
    borderRadius: 8,
    paddingHorizontal: SPACING.s12,
    marginBottom: SPACING.s12,
  },
  clipChip: {
    alignSelf: 'center',
    paddingTop: 0,
    paddingBottom: SPACING.s12,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingTop: SPACING.s10,
    paddingBottom: SPACING.s10,
    alignItems: 'center',
    borderRadius: 8,
    marginRight: SPACING.s12,
  },
})

export default memo(ActivationCard)
