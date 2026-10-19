import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import GlassSurface from '@/components/common/GlassSurface'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'

// 局部尺寸常量（终轮优化师 S-3：不导出防与全局 HEADER_HEIGHT 重名混淆）
const BTN_WIDTH = scaleSizeH(_HEADER_HEIGHT)

// 玻璃圆片（毛玻璃全体系阶段四，方案 §6 超时/设置钮同规格）：36 圆片垫底，图标浮于其上；
// 回退=透明底（现状无底色观感）
export default ({ icon, color, onPress }: {
  icon: string
  color?: string
  onPress: () => void
}) => {
  return (
    <TouchableOpacity onPress={onPress} style={{ ...styles.button, width: BTN_WIDTH }} activeOpacity={0.6}>
      <GlassSurface
        style={styles.glassCircle}
        fallbackColor="rgba(0, 0, 0, 0)"
        hairline="all"
      >
        <Icon name={icon} color={color} size={ICON_SIZE.control} />
      </GlassSurface>
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
