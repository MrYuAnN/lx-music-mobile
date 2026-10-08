import { Fragment, forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Popup, { type PopupType, type PopupProps } from '@/components/common/Popup'
import { useI18n } from '@/lang'

import SettingLyricProgress from './settings/SettingLyricProgress'
import SettingVolume from './settings/SettingVolume'
import SettingPlaybackRate from './settings/SettingPlaybackRate'
import SettingLrcFontSize from './settings/SettingLrcFontSize'
import SettingLrcAlign from './settings/SettingLrcAlign'
import SettingRoma from './settings/SettingRoma'

export type SettingPopupItem = 'lyricProgress' | 'volume' | 'rate' | 'fontSize' | 'align' | 'roma'

export interface SettingPopupProps extends Omit<PopupProps, 'children'> {
  direction: 'vertical' | 'horizontal'
  /** 展示的设置项，缺省为全量（横屏沿用） */
  items?: SettingPopupItem[]
}

export interface SettingPopupType {
  show: () => void
}

const SETTING_COMPONENTS: Record<SettingPopupItem, (direction: 'vertical' | 'horizontal') => React.ReactNode> = {
  lyricProgress: () => <SettingLyricProgress />,
  volume: () => <SettingVolume />,
  rate: () => <SettingPlaybackRate />,
  fontSize: direction => <SettingLrcFontSize direction={direction} />,
  align: () => <SettingLrcAlign />,
  roma: () => <SettingRoma />,
}

const DEFAULT_ITEMS: SettingPopupItem[] = ['lyricProgress', 'volume', 'rate', 'fontSize', 'align', 'roma']

export default forwardRef<SettingPopupType, SettingPopupProps>(({ direction, items = DEFAULT_ITEMS, ...props }, ref) => {
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  // console.log('render import export')
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
        <Popup ref={popupRef} title={t('play_detail_setting_title')} {...props}>
          <ScrollView>
            <View onStartShouldSetResponder={() => true}>
              {items.map(item => <Fragment key={item}>{SETTING_COMPONENTS[item](direction)}</Fragment>)}
            </View>
          </ScrollView>
        </Popup>
        )
      : null
  )
})
