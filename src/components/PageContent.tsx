import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, View, StyleSheet } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { AM_EASE_DURATION, amEase } from '@/utils/animation'
import { withAlpha } from '@/utils/color'
import { formatAmbientUri, getAmbientColors } from '@/utils/ambientColor'
import { getPlaylistHeroHeight } from '@/components/common/PlaylistHeader'
import ImageBackground, { prefetch } from './common/ImageBackground'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import playerState from '@/store/player/state'

interface Props {
  children: React.ReactNode
  /**
   * 沉浸式封面背景（播放页专用）：当前曲目封面模糊铺底。
   * 常规页面使用纯色底（AM 观感），不传即默认 false。
   */
  coverBg?: boolean
  /**
   * 静态封面氛围源（歌单页专用，歌单页重构批②）：传入歌单封面即启用氛围层，
   * 与 coverBg 互斥（同时传时 coverBg 优先）。取色/模糊/交叉淡入机制同播放页（审查 A6）。
   * 路由语义（氛围滚动批 2026-10-19）：未传=非歌单页走纯色底；传 null=歌单页无封面，
   * 同样走氛围层结构（纱罩+bg 色渐变，随滚动滚走）。
   */
  ambientPic?: string | null
  /** 歌单页滚动偏移（页面级 Animated.Value）：氛围图块 translateY=-scrollY 随内容 1:1 滚走（AM 同构） */
  scrollY?: Animated.Value
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)
// 歌单页静态氛围（QQ 式两段式，hero v2 拍板）：上半=封面背景图，下半=封面采样主色
// 延伸（displayTint 铺满整页，钳制按分支取 clampTint/refineTint，见下方治理批注释），交界渐变融化；播放页维持重模糊+均匀纱罩
// 2026-10-18 真机反馈轮 3：blur 6→3、纱罩渐变起点 0.55→0.72——Android blurRadius 同值观感重于 iOS，
// 叠纱罩后封面糊到不可辨识，顶部段多露原貌
// 2026-10-18 真机反馈轮 4：blur 3→0（原图沉浸，网易云/QQ 歌单头式）——轻糊中间态两头不靠，
// 既无原图辨识度又无重模糊氛围感；辨识度交原图承担，可读性交渐变纱罩承担
const STATIC_BLUR_RADIUS = 0

// 2026-10-18 可读性治理轮 5（grilling 四拍板+三席方案审查 0C/4I/9S）：blur=0 后鲜艳封面暴露两短板——
// 取色只钳亮度不钳饱和度（高饱和大红铺满页）、纱罩 0.72 起坡致 hero 顶部 72% 零遮罩（行压锐利原图）。
// 纱罩改双层：中性主题纱（亮白/暗黑，行压区兜底不依赖单张封面明暗）+ tint 三停渐变（顶段非零浓度→
// 起坡→hero 底全实融）。亮色纱 0.35 低于 Material light scrim 官方区间下限（40%），有意偏离——
// 轮 4 辨识度优先拍板+仿真 A 组（图区最差对比 亮/暗：vivid 5.2/6.2、neon 3.6/5.4、dark 4.2/10.6、
// white 11.5/3.2、teal 6.8/5.3）；首屏不压图，滚动停止后行可停驻顶部弱纱段，极端对角封面不保
// WCAG 4.5（业界同样不保，验收口径=可辨认），真机不可接受时预案=调 C 组（veil.40/top.45/onset.40）
const STATIC_SCRIM_ONSET = 0.45
// 2026-10-20 真机反馈轮 6（用户：封面蒙纱感重）：两纱减薄——中性纱 0.35→0.10、顶段色纱 0.4→0.22，
// 底段过渡坡（0.45 起坡→bg 全实）不动；结构不变只提封面清晰度。滚动行压可读性由残纱+瞬态兜底，
// 真机走查若行压不可辨认再回调（预案=veil .20/top .30）
// 2026-10-20 真机反馈轮 7（用户拍板「归 0 试一下」）：两纱全归 0——0~45% 段纯封面原图直出，
// 过渡由渐变层底段独立承担（45% 起从全透明渐浓到 bg 全实，封面自然淡出融白）；滚动行压无纱罩，
// 可读性完全靠瞬态+发丝顶栏，不可接受时回退本轮前值（veil .10/top .22）
const STATIC_TOP_ALPHA = 0
const STATIC_VEIL_OPACITY = 0

// 主色亮度钳制：暗色模式压亮度上限防刺眼，亮色模式抬下限防发灰（AM 氛围层观感）
const TINT_LIGHTNESS_RANGE = {
  dark: [0.28, 0.58] as const,
  light: [0.42, 0.68] as const,
}

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '')
  const full = value.length == 3 ? value.split('').map(c => c + c).join('') : value
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

const rgbToHsl = ([r, g, b]: [number, number, number]): [number, number, number] => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max == min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max == rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max == gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h, s, l]
}

const hslToHex = ([h, s, l]: [number, number, number]): string => {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s == 0) {
    const v = Math.round(l * 255)
    return `#${[v, v, v].map(c => c.toString(16).padStart(2, '0')).join('')}`
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const rgb = [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
  return `#${rgb.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`
}

const clampTint = (hex: string, isDark: boolean): string => {
  const [min, max] = isDark ? TINT_LIGHTNESS_RANGE.dark : TINT_LIGHTNESS_RANGE.light
  const hsl = rgbToHsl(hexToRgb(hex))
  hsl[2] = Math.min(Math.max(hsl[2], min), max)
  return hslToHex(hsl)
}

// 歌单页静态氛围取色治理（轮 5 拍板）：饱和度钳上限 + 亮度直接取对主题文字对比度最优端点
// （亮色黑字→推浅、暗色白字→推深，业界「固定前景、管住背景」口径）。播放页分支不走此路径
// （保留 clampTint 原亮度钳制，播放页零变化）。三数值无业界同构先例（M3 HCT tone≠HSL L），
// 本产品自定=对比度与 tint 保色的平衡点（纯白/纯黑数学最优但杀色相）。回归锚（同实现 WCAG 仿真，
// dominant→亮色输出/对黑字对比 | 暗色输出/对白字对比，改动三常量前先核对不回退 4.5:1 底线）：
//   蜘蛛侠红(227,23,10)→#d59490/7.09 | #6f2e2a/9.58    近白(240,240,238)→#b7b7ae/8.71 | #515148/7.68
//   teal(24,117,118)→#90d4d5/10.52 | #2a6e6f/5.65      霓虹底(8,40,10)→#90d594/10.16 | #2a6f2e/5.90
const TINT_SATURATION_CAP = 0.45
const TINT_LIGHT_ENDPOINT = 0.7
const TINT_DARK_ENDPOINT = 0.3

const refineTint = (hex: string, isDark: boolean): string => {
  const hsl = rgbToHsl(hexToRgb(hex))
  hsl[1] = Math.min(hsl[1], TINT_SATURATION_CAP)
  hsl[2] = isDark ? TINT_DARK_ENDPOINT : TINT_LIGHT_ENDPOINT
  return hslToHex(hsl)
}

// 提取器通用层（审查 A6 两层抽象）：pic 源无关的预载+取色。stale 守卫替代原播放页的
// 「比对当前曲目」守卫（L104/L110 旧实现）：源切换/卸载即弃在途回包，静态源（歌单页）
// 与事件源（播放页）共用。取色 dominant→average 兜底；defaultColor 为原生取色失败兜底；
// headers 与可见封面请求一致；失败告警后回退纯模糊底
export const useCoverAmbient = (sourcePic: string | null) => {
  const [pic, setPic] = useState<string | null>(null)
  const [tint, setTint] = useState<string | null>(null)

  useEffect(() => {
    if (!sourcePic) {
      // 无封面（自建歌单/本地歌/封面加载失败）：清空回默认底，避免残留上一份氛围
      setPic(null)
      setTint(null)
      return
    }
    const picUrl = formatAmbientUri(sourcePic)
    let stale = false
    void prefetch(picUrl).catch(() => {}).then(() => {
      if (stale) return
      setPic(picUrl)
    })
    void getAmbientColors(picUrl).then(result => {
      if (stale) return
      const nextTint = result.dominant ?? result.average ?? null
      if (nextTint) setTint(nextTint)
    }).catch(err => {
      console.warn('image colors failed', err)
    })
    return () => {
      stale = true
    }
  }, [sourcePic])

  return { pic, tint }
}

// 源层（播放页）：订阅当前曲目封面变化，交提取器通用层处理
const usePlayerCover = (enabled: boolean) => {
  const [musicPic, setMusicPic] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const handlePicUpdate = () => {
      const pic = playerState.musicInfo.pic
      setMusicPic(pic && pic != playerState.loadErrorPicUrl ? pic : null)
    }
    handlePicUpdate()
    global.state_event.on('playerMusicInfoChanged', handlePicUpdate)
    return () => {
      global.state_event.off('playerMusicInfoChanged', handlePicUpdate)
    }
  }, [enabled])

  return useCoverAmbient(musicPic)
}

export default ({ children, coverBg = false, ambientPic, scrollY }: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  // 氛围源二选一：coverBg（播放页，跟随当前曲目）优先；否则用静态源（歌单页）。两层 hook
  // 恒定运行（disabled/空源时为空实现），仅取值按开关路由，保证 hooks 顺序稳定
  const playerAmbient = usePlayerCover(coverBg)
  const staticAmbient = useCoverAmbient(coverBg ? null : ambientPic ?? null)
  const { pic, tint } = coverBg ? playerAmbient : staticAmbient

  // 渐变过渡：切歌时旧 tint 淡出→换色→新 tint 淡入，避免主色跳变；
  // 起链前打断旧链 + 最新值守卫，防快速切歌时过期回调回写旧色
  const [displayTint, setDisplayTint] = useState<string | null>(null)
  const tintAlpha = useRef(new Animated.Value(0)).current
  const latestTintRef = useRef<string | null>(null)

  useEffect(() => {
    if (!tint) {
      latestTintRef.current = null
      tintAlpha.stopAnimation()
      tintAlpha.setValue(0)
      setDisplayTint(null)
      return
    }
    // 播放页保留原亮度钳制（分支隔离，displayTint 产色零变化）；静态歌单页走治理后端点钳制
    const next = coverBg ? clampTint(tint, theme.isDark) : refineTint(tint, theme.isDark)
    latestTintRef.current = next
    tintAlpha.stopAnimation()
    if (!displayTint) {
      setDisplayTint(next)
      Animated.timing(tintAlpha, { toValue: 1, duration: AM_EASE_DURATION, easing: amEase, useNativeDriver: true }).start()
    } else if (next != displayTint) {
      Animated.timing(tintAlpha, { toValue: 0, duration: AM_EASE_DURATION / 2, easing: amEase, useNativeDriver: true }).start(({ finished }) => {
        if (!finished || latestTintRef.current != next) return
        setDisplayTint(next)
        Animated.timing(tintAlpha, { toValue: 1, duration: AM_EASE_DURATION / 2, easing: amEase, useNativeDriver: true }).start()
      })
    }
    return () => {
      tintAlpha.stopAnimation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tint, theme.isDark, coverBg])

  // 常规页面：AM 式纯色底（c-app-background），无主题背景图/动态背景
  const solidComponent = (
    <View style={{ flex: 1, backgroundColor: theme['c-app-background'] }}>
      {children}
    </View>
  )

  // 歌单页头部氛围（基底①拍板 2026-10-19，推翻 10-19 tint 全屏驻留——真机实证滚走后全屏平面
  // 采样色浑浊+残影）：氛围只活在头部带——封面原图（blur=0）+中性主题纱+tint 顶段淡纱随内容
  // 1:1 滚走，图块底渐变终点=主题底色无缝衔接，滚走后整页回归纯白/纯黑主题底（Spotify/YTM
  // 同构）；播放页维持原结构（分支物理隔离）。sampleColor 语义已随驻留层删除收窄为「顶段淡纱色」
  // （终轮优化师 S-2 改名提案因真机二分撤回——改名与空白疑云同期，保命名留注释）。取色晚到时
  // 顶段纱色轻跳变为已知观察项（审查 S-a，验收①走查）
  const bg = theme['c-content-background']
  const isStaticAmbient = !coverBg
  const sampleColor = displayTint ?? bg
  const heroHeight = getPlaylistHeroHeight(windowSize.height)

  // 氛围图块随滚动 1:1 滚走（2026-10-19 拍板，AM 同构）：具象封面层附着内容离场、与 hero
  // 相对静止，全屏 tint 层驻留承接（图块底部渐变终点=满 tint，无缝无硬边）；translateY 节点
  // useMemo 稳定，未传 scrollY 不挂 transform（旧行为兜底）
  const heroTranslate = useMemo(() => (scrollY ? Animated.multiply(scrollY, -1) : null), [scrollY])

  const staticComponent = (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: heroHeight,
          width: '100%',
          transform: heroTranslate ? [{ translateY: heroTranslate }] : undefined,
        }}
      >
        {/* 恒不门控（真机反馈 2026-10-19：onLoad 在 Fresco 缓存命中时不触发/绘制不失效——
            首进歌单封面空白、滑动改 transform 强制重绘才显；基底①后页面底即白，门控防闪变
            前提已消失，图加载完成由 Fresco 原生失效上屏）。无封面（pic=null）同理直接可见：
            纱罩+bg 色渐变层随滚走 */}
        <ImageBackground
          style={StyleSheet.absoluteFill}
          source={pic ? { uri: pic, headers: defaultHeaders } : undefined}
          resizeMode="cover"
          blurRadius={STATIC_BLUR_RADIUS}
        >
          <View
            style={{ ...StyleSheet.absoluteFill, backgroundColor: theme.isDark ? '#000000' : '#ffffff', opacity: STATIC_VEIL_OPACITY }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[withAlpha(sampleColor, STATIC_TOP_ALPHA), withAlpha(sampleColor, STATIC_TOP_ALPHA), bg]}
            locations={[0, STATIC_SCRIM_ONSET, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      </Animated.View>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {children}
      </View>
    </View>
  )

  const coverComponent = isStaticAmbient ? staticComponent : (
    <>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ImageBackground
          style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: bg }}
          source={pic ? { uri: pic, headers: defaultHeaders } : undefined}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
        >
          <View style={{ flex: 1, flexDirection: 'column', backgroundColor: bg, opacity: 0.76 }}></View>
          {displayTint ? (
            <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
              <LinearGradient
                colors={[`${displayTint}88`, `${displayTint}00`, `${displayTint}44`]}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}
        </ImageBackground>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {children}
        </View>
      </View>
    </>
  )

  return (
    <>
      <SizeView />
      {coverBg || ambientPic !== undefined ? coverComponent : solidComponent}
    </>
  )
}
