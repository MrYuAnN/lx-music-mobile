import { useEffect, useRef, useState } from 'react'
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
   */
  ambientPic?: string | null
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)
// 歌单页静态氛围（QQ 式两段式，hero v2 拍板）：上半=封面背景图（轻模糊），下半=封面采样主色
// 延伸（clampTint 按主题钳亮度的 displayTint 铺满整页），交界渐变融化；播放页维持重模糊+均匀纱罩
const STATIC_BLUR_RADIUS = Math.max(scaleSizeAbsHR(6), 4)

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

export default ({ children, coverBg = false, ambientPic }: Props) => {
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
    const next = clampTint(tint, theme.isDark)
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
  }, [tint, theme.isDark])

  // 常规页面：AM 式纯色底（c-app-background），无主题背景图/动态背景
  const solidComponent = (
    <View style={{ flex: 1, backgroundColor: theme['c-app-background'] }}>
      {children}
    </View>
  )

  // 歌单页 QQ 式两段式（拍板 2026-10-17）：整页先铺「采样主色」=下半的采样延伸（displayTint
  // 经 clampTint 按主题钳亮度，文字对比有保障），上半叠封面背景图（轻模糊），图底以
  // 「透明→采样主色」渐变融化，无分界线。播放页维持原结构。
  // 首帧淡入（真机反馈 2026-10-17）：取色异步到位瞬间页面底色白→采样色硬切闪变——采样色层
  // 以 opacity 淡入；封面图 prefetch 完成后 onLoad 淡入接管，消弹入感
  const bg = theme['c-content-background']
  const isStaticAmbient = !coverBg
  const sampleColor = displayTint ?? bg
  const heroHeight = getPlaylistHeroHeight(windowSize.height)
  const sampleOpacity = useRef(new Animated.Value(0)).current
  const [heroImgLoaded, setHeroImgLoaded] = useState(false)

  useEffect(() => {
    if (isStaticAmbient && displayTint) {
      Animated.timing(sampleOpacity, { toValue: 1, duration: AM_EASE_DURATION, easing: amEase, useNativeDriver: true }).start()
    } else {
      sampleOpacity.setValue(0)
    }
  }, [isStaticAmbient, displayTint, sampleOpacity])

  useEffect(() => {
    setHeroImgLoaded(false)
  }, [pic])

  const staticComponent = (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <Animated.View
        style={{ ...StyleSheet.absoluteFill, backgroundColor: sampleColor, opacity: sampleOpacity }}
        pointerEvents="none"
      />
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: heroHeight, width: '100%', opacity: heroImgLoaded ? 1 : 0 }}
        source={pic ? { uri: pic, headers: defaultHeaders } : undefined}
        resizeMode="cover"
        blurRadius={STATIC_BLUR_RADIUS}
        onLoad={() => { setHeroImgLoaded(true) }}
      >
        <LinearGradient
          colors={[withAlpha(sampleColor, 0), sampleColor]}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>
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
      {coverBg || ambientPic != null ? coverComponent : solidComponent}
    </>
  )
}
