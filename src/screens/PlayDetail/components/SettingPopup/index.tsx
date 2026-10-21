import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Popup, { type PopupType, type PopupProps } from '@/components/common/Popup'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'

import SettingTimeoutExit from './settings/SettingTimeoutExit'
import SettingLyricProgress from './settings/SettingLyricProgress'
import SettingPlaybackRate from './settings/SettingPlaybackRate'
import SettingLrcFontSize from './settings/SettingLrcFontSize'
import SettingLrcAlign from './settings/SettingLrcAlign'

export interface SettingPopupProps extends Omit<PopupProps, 'children'> {
  direction: 'vertical' | 'horizontal'
}

export interface SettingPopupType {
  show: () => void
}

// 「更多」弹层（2026-10-20 真机反馈重构：①标题对齐三点菜单 label「更多」（原「播放器设置」名实
// 不符）②把手对齐全弹窗体系、去右上叉 ③音量滑杆移除（系统音量键/音量键直达已覆盖，弹层内冗余））
export default forwardRef<SettingPopupType, SettingPopupProps>(({ direction, ...props }, ref) => {
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    show() {
      if (visible) popupRef.current?.setVisible(true)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
        })
      }
    },
  }))


  return (
    visible
      ? (
        <Popup ref={popupRef} title={t('more_action')} handle closeBtn={false} {...props}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* AM 式直排布局（2026-10-21 真机反馈：白底行卡在玻璃上成白框——改玻璃面板直排裸行，
                行间缩进发丝线分隔，层级靠行节奏+分隔线+控件体量） */}
            <View style={styles.cards} onStartShouldSetResponder={() => true}>
              <SettingTimeoutExit />
              <Divider />
              <SettingLyricProgress />
              <Divider />
              <SettingPlaybackRate />
              {/* 字体大小已上播放页歌词动作行（方案 §问题7 拍板：竖屏删、横屏留） */}
              {direction == 'horizontal'
                ? (
                    <>
                      <Divider />
                      <SettingLrcFontSize direction={direction} />
                    </>
                  )
                : null}
              <Divider />
              <SettingLrcAlign />
            </View>
          </ScrollView>
        </Popup>
        )
      : null
  )
})

// 行间发丝线（Apple Music 弹层同款缩进式：线起于 label 对齐位，不顶面板边缘）
const Divider = () => {
  const theme = useTheme()
  return <View style={{ ...styles.divider, backgroundColor: theme['c-border-background'] }} />
}

const styles = createStyle({
  cards: {
    paddingTop: SPACING.s2,
    paddingBottom: SPACING.s16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SPACING.s16,
  },
})
