import { Platform, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import BlurView from '@sbaiahmed1/react-native-blur'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'

// 玻璃材质单源（毛玻璃全体系方案 §2.1，2026-10-19 三席审查定稿）：blur 引擎=@sbaiahmed1/react-native-blur
// （Android 12+ RenderEffect 硬件实时模糊/iOS UIVisualEffectView），主题双态 tint+发丝描边同源。
// API<31 或降级开关关闭时回退 fallbackColor（消费方现状底色），无玻璃不残缺（方案 §7.1）。
// 圆角走 radius prop 由本组件自持（borderRadius+overflow hidden 同视图）：发丝描边与 blur 裁切
// 跟随弧段——描边画在方形根 View 再靠外层容器裁切的旧用法四角必断线（批三修正，PlayerBar 实例）。
// 校准期整体降级开关（方案 §1）：玻璃参数真机定稿后随定稿移除。
// 2026-10-19 晚 hero 空白疑云二分第一轮「关玻璃」后未拨回，已确认系排查残留（结论=bundle 陈旧），恢复实施值 true
const GLASS_ENABLED = true
// RenderEffect 硬件实时模糊门槛
const GLASS_MIN_ANDROID_API = 31
// 模糊强度（2026-10-20 真机校准：轮一 24→48，轮二 48→64——白底内容页可感知度仍不足）
const GLASS_BLUR_AMOUNT = 64
// 引擎 blurType 恒取最小内置叠色（light='regular'≈14% 白 / dark='systemUltraThinMaterialDark'≈25% 暗），
// 精准 tint 由本组件 overlay 层单源承担，防 blurType 内置色与 overlay 双计漂移。
// 该前提在 Android 端为代码级实证（库 ReactNativeBlurView.kt setBlurType→setOverlayColor 生效，
// 审查 PM 席核）但引擎级观感未真机实证——真机首日对拍 blurType 换挡截图（审查优化师 I-3），
// 若引擎忽略内置叠色则 TINT 初值按单层承担重算。
// iOS 已知限制：UIVisualEffectView 不支持 alpha<1（Apple 官方口径），消费方对本组件做 opacity
// 动画在 iOS 可能退化为硬切（PlaylistTopBar 注释/方案 §7 已备案，本批 iOS 仅核对不炸）
const BLUR_TYPE = { light: 'regular', dark: 'systemUltraThinMaterialDark' } as const
// 顶栏/迷你条/播放页钮 overlay tint（2026-10-20 真机校准：轮一 白 0.62→0.38/暗 0.55→0.45，
// 轮二 白 0.38→0.26/暗 0.45→0.38——白底内容页可感知度仍不足，继续增透；可读性由发丝线兜底）
const BAR_TINT = {
  light: 'rgba(255, 255, 255, 0.26)',
  dark: 'rgba(22, 16, 18, 0.38)',
}
// 弹层族跨窗模糊 tint（SheetBase/Menu blur-behind 无引擎内置叠色，维持较高遮蔽保浮层可读性，
// 不随顶栏族校准联动）。GLASS_TINT 同源导出供跨窗模糊面板复用
const TINT = {
  light: 'rgba(255, 255, 255, 0.62)',
  dark: 'rgba(22, 16, 18, 0.55)',
}
export const GLASS_TINT = TINT
// 发丝线单源：组卡实色化（2026-10-23 全应用 UI 统一治理拍板 #2/#7）后组卡撤玻璃保发丝线。
// 色由本组件导出（GLASS_HAIRLINE_COLOR + getGlassHairlineColor 明暗取色 helper）；
// 线宽单源在 theme（BorderWidths.normal，与下方 hairlineAll/hairlineBottom 同引用），改线宽去 theme
const HAIRLINE_COLOR = {
  light: 'rgba(0, 0, 0, 0.10)',
  dark: 'rgba(255, 255, 255, 0.10)',
}
export const GLASS_HAIRLINE_COLOR = HAIRLINE_COLOR
export const getGlassHairlineColor = (isDark: boolean) => (isDark ? HAIRLINE_COLOR.dark : HAIRLINE_COLOR.light)
// 顶栏/钉位子头玻璃 chrome 渐显区间（方案 §5 单源）。2026-10-20 校准轮二：[140,320]→[20,120]——
// 原区间过渡带过长，内容从 scroll≈0 就钻到子头底下，半透明玻璃+半可见内容+垫层底缘硬切=穿模感
// （用户真机反馈）；压缩后内容刚到玻璃已满（iOS 导航栏同构）。真机校准调参只改此处
export const GLASS_FADE_RANGE = [20, 120]
// 玻璃不可用（API<31/降级开关）时顶栏与钉位子头的回退底色——回退态无模糊需更高遮蔽保可读性
// （审查 PM S-6 口径，高于 tint）；子头批三席审查 S-A 收敛为单源（原 8 处字面量复制）
export const GLASS_BAR_FALLBACK = {
  light: 'rgba(255, 255, 255, 0.78)',
  dark: 'rgba(18, 12, 16, 0.72)',
}

// 媒体浮层 tint（2026-10-23 批 F 新增单源；**批 F2 走查反馈修正：亮态黑基→白基磨砂**）。
// 拍板 #3 双态语言（亮=白磨砂+黑字/暗=深玻璃+白字）对媒体浮层同构适用——初版「亮态黑基
// 0.30」系错误推理（误以为白基浊化封面；实际浅色主题播放页底=76% 白纱罩的近白氛围，黑玻璃
// +四黑图标=走查「黑不拉几」反例）。现值：亮=白基 0.55（悬浮白玻璃卡）/暗=黑基 0.40；
// **双态数值均无业界公开对标，本产品自定，真机校准点**。
// 【净口径校准清单——三席审查备案，校准时合并计算】①blurType 引擎内置叠色未随 media 分族：
// 亮态 regular≈14% 白与白基 overlay 同向、暗态≈25% 暗同向叠加，净遮蔽以真机对拍为准；
// ②blurAmount 沿用 64（白底内容页校准值），媒体底是否同档待验。头部功能钮圆片仍 bar 族
// （10-20 校准拍板），是否迁 media 为独立拍板项不随本批
const MEDIA_TINT = {
  light: 'rgba(255, 255, 255, 0.55)',
  dark: 'rgba(0, 0, 0, 0.40)',
}

export const isGlassSupported = () => {
  return Platform.OS == 'ios' || Number(Platform.Version) >= GLASS_MIN_ANDROID_API
}

interface Props {
  style?: StyleProp<ViewStyle>
  /** 模糊强度 0-100（方案 §1 初值 24，校准点） */
  blurAmount?: number
  /** 圆角半径：传入即本组件自持圆角+内部裁切（玻璃/回退两分支同享），圆角玻璃一律走此 prop。
   *  存量 PlayDetail Btn/ControlBtn 暂留 style 自带圆角（幸免断线）随圆角取值体系治理批次迁移；
   *  style 内 borderRadius 会覆盖本 prop（style 居数组末位），勿同传；
   *  与 hairline='bottom' 组合现无消费方——RN Android 单边边框×圆角有历史绘制 quirk，启用前先真机核验 */
  radius?: number
  /** 发丝描边形态（方案 §1）：all=四周边框（悬浮卡），bottom=底缘（顶栏），none=无 */
  hairline?: 'all' | 'bottom' | 'none'
  /** 玻璃不可用回退底色（必填：回退态不模糊，消费方须按自身场景给足遮蔽，架构席 S-2） */
  fallbackColor: string
  /** overlay tint 族（2026-10-23 批 F 拆分）：bar=白基提亮（白底 chrome 顶栏族，默认）；
   *  media=媒体浮层族（亮=白磨砂 0.55/暗=黑基暗化 0.40，双态口径见 MEDIA_TINT 注释）——两族勿混用 */
  variant?: 'bar' | 'media'
  children?: React.ReactNode
}

export default ({ style, blurAmount = GLASS_BLUR_AMOUNT, hairline = 'none', radius, fallbackColor, variant = 'bar', children }: Props) => {
  const theme = useTheme()
  const mode = theme.isDark ? 'dark' : 'light'
  const tint = variant == 'media' ? MEDIA_TINT[mode] : BAR_TINT[mode]
  const hairlineColor = { borderColor: HAIRLINE_COLOR[mode] }
  const hairlineStyles = [
    hairline == 'all' && styles.hairlineAll,
    hairline == 'bottom' && styles.hairlineBottom,
    hairline != 'none' && hairlineColor,
  ]
  const radiusStyle: ViewStyle | null = radius == null ? null : { borderRadius: radius, overflow: 'hidden' }

  if (!GLASS_ENABLED || !isGlassSupported()) {
    // 透明回退底（播放页钮类「回退=现状无底色」）连发丝线一起跳过——透明底+描边=悬空框，
    // 违反「回退=现状」（终轮架构 I-5/优化师 I-1）；实色回退（顶栏/迷你条）保留描边
    const isTransparentFallback = fallbackColor == 'rgba(0, 0, 0, 0)' || fallbackColor == 'transparent'
    return (
      <View style={[styles.surface, { backgroundColor: fallbackColor }, radiusStyle, ...(isTransparentFallback ? [] : hairlineStyles), style]}>
        {children}
      </View>
    )
  }

  return (
    <View style={[styles.surface, radiusStyle, ...hairlineStyles, style]}>
      <BlurView style={styles.backdrop} blurType={BLUR_TYPE[mode]} blurAmount={blurAmount} />
      {/* overlay tint 层：顶栏族 BAR_TINT 单源精准承担（弹层族走 GLASS_TINT 跨窗路径不共用；
          媒体浮层族 MEDIA_TINT 双态口径，variant='media'） */}
      <View style={[styles.backdrop, { backgroundColor: tint }]} pointerEvents="none" />
      {children}
    </View>
  )
}

const styles = createStyle({
  surface: {},
  backdrop: {
    // N2：RN 0.86 移除 absoluteFillObject，absoluteFill 为普通对象可展开
    ...StyleSheet.absoluteFill,
  },
  hairlineAll: {
    borderWidth: BorderWidths.normal,
  },
  hairlineBottom: {
    borderBottomWidth: BorderWidths.normal,
  },
})
