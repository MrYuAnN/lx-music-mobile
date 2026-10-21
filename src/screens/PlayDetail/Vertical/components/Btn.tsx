import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import GlassSurface from '@/components/common/GlassSurface'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'

// 局部尺寸常量（终轮优化师 S-3：不导出防与全局 HEADER_HEIGHT 重名混淆）
const BTN_WIDTH = scaleSizeH(_HEADER_HEIGHT)

// 头部钮（毛玻璃全体系阶段四，方案 §6）：功能钮（超时/设置）=36 玻璃圆片垫底，图标浮于其上，
// 回退=透明底；**返回钮走 plain（真机反馈 2026-10-20 用户拍板去圆球）**——返回是导航动作，
// 对齐全应用顶栏返回裸图标惯例（歌单页 PlaylistTopBar 同款），玻璃圆片仅功能钮保留
export default ({ icon, color, onPress, plain = false }: {
  icon: string
  color?: string
  onPress: () => void
  plain?: boolean
}) => {
  return (
    <TouchableOpacity onPress={onPress} style={{ ...styles.button, width: BTN_WIDTH }} activeOpacity={0.6}>
      {
        plain
          ? <Icon name={icon} color={color} size={ICON_SIZE.control} />
          : (
              <GlassSurface
                style={styles.glassCircle}
                fallbackColor="rgba(0, 0, 0, 0)"
                hairline="all"
              >
                <Icon name={icon} color={color} size={ICON_SIZE.control} />
              </GlassSurface>
            )
      }
    </TouchableOpacity>
  )
}

const styles = createStyle({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flex: 0,
  },
  glassCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
