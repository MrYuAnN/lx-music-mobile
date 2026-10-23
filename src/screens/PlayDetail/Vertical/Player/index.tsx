import { memo } from 'react'
import Animated from 'react-native-reanimated'

// import Title from './components/Title'
import ActionRow from './components/ActionRow'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import GlassSurface from '@/components/common/GlassSurface'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useIntroStyle } from '@/navigation/transitions/intro'
import { useBottomInset } from '@/utils/insetsTool'
import { SPACING } from '@/config/spacing'

// 控制区基础底距（原型 1:1 dp）；运行时叠加导航栏 inset（edge-to-edge）
const PLAYER_PADDING_BOTTOM = 15

export default memo(({ page }: { page: number }) => {
  const navBarInset = useBottomInset(true)
  // push 元素进出场（RNN elementTransitions 等价：alpha 0→1 + translationY +32→0）
  const introStyle = useIntroStyle('player')

  return (
    <Animated.View
      style={[{ ...styles.container, paddingBottom: PLAYER_PADDING_BOTTOM + navBarInset }, introStyle]}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}
    >
      <ActionRow page={page} />
      {/* 控制面板（2026-10-23 批 F C 档，AM iOS 26 底部形态同构，用户拍板）：进度+控制一体
          玻璃面板（媒体浮层口径 MEDIA_TINT 黑基暗化，radius 16 媒体浮层档），ActionRow 二级
          功能行留外保持轻/重层级；控制胶囊（四黑一红）拆壳收编入面板；回退=透明底现状观感；
          走查可选精致化=进度贴面板上缘细线（AM 同款，首版不做） */}
      <GlassSurface
        variant="media"
        radius={16}
        hairline="all"
        fallbackColor="rgba(0, 0, 0, 0)"
        style={styles.panel}
      >
        <PlayInfo />
        <ControlBtn />
      </GlassSurface>
    </Animated.View>
  )
})

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s16,
    paddingTop: SPACING.s6,
    flexDirection: 'column',
  },
  // 面板内边距（初值，真机校准点）：面板外缘与 ActionRow 同缩进（container s16），内容刻意
  // 再内缩 s16 一档（AM 悬浮面板「内容内缩」常态，非对齐 ActionRow）——走查定案；面板内容
  // 自适应高度不定高（Player 区 flex:0 无剩余空间，flexGrow/flexShrink 为无效声明不写）
  panel: {
    paddingHorizontal: SPACING.s16,
    paddingTop: SPACING.s10,
    paddingBottom: SPACING.s6,
  },
})
