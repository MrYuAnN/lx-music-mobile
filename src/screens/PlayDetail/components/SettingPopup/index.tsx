import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Popup, { type PopupType, type PopupProps } from '@/components/common/Popup'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

import SettingTimeoutExit from './settings/SettingTimeoutExit'
import SettingDislike from './settings/SettingDislike'
import SettingPlaybackRate from './settings/SettingPlaybackRate'

export interface SettingPopupProps extends Omit<PopupProps, 'children'> {
  /** @deprecated 2026-11-05 弹窗重构后横竖屏内容不再分流，字段无消费；遗留兼容，随下一批清理 */
  direction?: 'vertical' | 'horizontal'
}

export interface SettingPopupType {
  show: () => void
}

// 「更多」弹层（2026-10-20 真机反馈重构：标题对齐三点菜单 label「更多」+把手对齐全弹窗体系）
// 2026-11-05 弹窗重构拍板（grilling 六拍板）：**动作清单化**——持久设置全迁设置页（AM/Spotify
// 菜单纯动作同构）：拖拽歌词进度/罗马音/对齐/字号四项归设置页 Player 歌词组（罗马音为孤儿
// 组件补挂，其余三组件重写迁移）；弹窗只留三动作（定时关闭/播放速率/加入黑名单）。
// 形态：单组无节头（分组头为多组而设）紧凑列表；三动作 AM 行三件套（图标+文案+右值），
// 组件注释见各 Setting*；行间发丝线（原「组间边界」语义随单组化自然消解，行距+发丝线承层级）
export default forwardRef<SettingPopupType, SettingPopupProps>((props, ref) => {
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
            {/* AM 式玻璃面板直排裸行（2026-10-21 拍板：白底行卡在玻璃上成白框——行间缩进发丝线） */}
            <View style={styles.cards} onStartShouldSetResponder={() => true}>
              <SettingTimeoutExit />
              <SettingPlaybackRate />
              <SettingDislike onDismiss={() => { popupRef.current?.setVisible(false) }} />
            </View>
          </ScrollView>
        </Popup>
        )
      : null
  )
})

const styles = createStyle({
  cards: {
    paddingTop: SPACING.s2,
    paddingBottom: SPACING.s16,
  },
})
