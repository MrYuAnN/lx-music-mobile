import { useRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import PlayListPanel, { type PlayListPanelType } from '@/components/player/PlayListPanel'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { ICON_SIZE } from '@/config/constant'

// 播放队列入口按钮（横竖屏共用；原 Vertical MoreBtn/QueueBtn 上移共享，弹窗体系批）
// color 可选：竖屏控制行传主字色与三键归一（2026-10-21 拍板「四黑一红」）；缺省灰供横屏 MoreBtn 列
const BTN_WIDTH = scaleSizeW(36)

export default ({ color }: { color?: string }) => {
  const theme = useTheme()
  const panelRef = useRef<PlayListPanelType>(null)

  return (
    <>
      <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={() => { panelRef.current?.show() }}>
        <Icon name="playlist-music" color={color ?? theme['c-font-label']} size={ICON_SIZE.control} />
      </TouchableOpacity>
      <PlayListPanel ref={panelRef} />
    </>
  )
}

const styles = createStyle({
  cotrolBtn: {
    width: BTN_WIDTH,
    height: BTN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
