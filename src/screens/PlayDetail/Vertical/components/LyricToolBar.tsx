import { memo, useRef } from 'react'
import { View } from 'react-native'

import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { toggleTranslation } from '@/core/lyric'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import ToolBtn from './ToolBtn'
import { DesktopLyricBtn } from './ActionBar'

// 歌词工具行（歌词页专属）：字号 / 翻译 / 对齐 / 桌面歌词 / 更多（歌词进度条、罗马音）
// 字号与对齐为循环切换（设置弹层内保留精细调节则无同步问题，此处直调设置项）

const FONT_SIZE_STEPS = [120, 160, 200, 240, 280]
const ALIGN_VALUES = ['left', 'center', 'right'] as const

const FontSizeBtn = () => {
  const t = useI18n()
  const lrcFontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')

  const toggleNextSize = () => {
    const index = FONT_SIZE_STEPS.indexOf(lrcFontSize)
    const next = FONT_SIZE_STEPS[(index + 1) % FONT_SIZE_STEPS.length] ?? FONT_SIZE_STEPS[0]
    updateSetting({ 'playDetail.vertical.style.lrcFontSize': next })
  }

  return <ToolBtn glyph="A" label={t('play_detail_tool_font_size')} onPress={toggleNextSize} />
}

const TranslationBtn = () => {
  const t = useI18n()
  const isShowTranslation = useSettingValue('player.isShowLyricTranslation')

  const handleToggle = () => {
    const next = !isShowTranslation
    updateSetting({ 'player.isShowLyricTranslation': next })
    void toggleTranslation(next)
  }

  return <ToolBtn glyph="译" label={t('play_detail_tool_translation')} active={isShowTranslation} onPress={handleToggle} />
}

const AlignBtn = () => {
  const t = useI18n()
  const align = useSettingValue('playDetail.style.align')

  const toggleNextAlign = () => {
    const index = ALIGN_VALUES.indexOf(align)
    const next = ALIGN_VALUES[(index + 1) % ALIGN_VALUES.length]
    updateSetting({ 'playDetail.style.align': next })
  }

  return <ToolBtn icon="slider" label={t('play_detail_tool_align')} onPress={toggleNextAlign} />
}

const MoreBtn = () => {
  const t = useI18n()
  const popupRef = useRef<SettingPopupType>(null)

  const handleShow = () => {
    popupRef.current?.show()
  }

  return (
    <>
      <ToolBtn icon="dots-vertical" label={t('play_detail_action_more')} onPress={handleShow} />
      <SettingPopup ref={popupRef} direction="vertical" items={['lyricProgress', 'roma']} />
    </>
  )
}

export default memo(() => {
  return (
    <View style={styles.container}>
      <FontSizeBtn />
      <TranslationBtn />
      <AlignBtn />
      <DesktopLyricBtn />
      <MoreBtn />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
})
