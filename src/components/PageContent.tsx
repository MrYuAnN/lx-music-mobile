import { useEffect, useRef, useState } from 'react'
import { Animated, View, StyleSheet } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import RNImageColors from 'react-native-image-colors'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { AM_EASE_DURATION, amEase } from '@/utils/animation'
import ImageBackground, { prefetch } from './common/ImageBackground'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import playerState from '@/store/player/state'
// 包类型声明与运行时导出不一致：metro 实际入口 src/index.ts 仅有 default 导出
// （getColors 挂在 default 对象上），须按运行时形态取用，勿改为命名导入（AM-6 回归教训）
const getColors = (RNImageColors as unknown as {
  getColors: (source: string, config?: {
    defaultColor?: string
    cache?: boolean
    headers?: Record<string, string>
  }) => Promise<{ dominant?: string, average?: string, platform: string }>
}).getColors

interface Props {
  children: React.ReactNode
  /**
   * 沉浸式封面背景（播放页专用）：当前曲目封面模糊铺底。
   * 常规页面使用纯色底（AM 观感），不传即默认 false。
   */
  coverBg?: boolean
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)

const formatUri = (url: string) => (url.startsWith('/') ? `file://${url}` : url)

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

// 订阅当前曲目封面变化（原 core/init/common.ts 的动态背景逻辑收编于此，
// theme.dynamicBg 设置随 AM 化退役，封面背景仅由 coverBg 显式开启）
const usePlayerCover = (enabled: boolean) => {
  const [pic, setPic] = useState<string | null>(null)
  const [tint, setTint] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const handleUpdatePic = (pic: string) => {
      if (!pic) return
      const picUrl = formatUri(pic)
      void prefetch(picUrl).catch(() => {}).then(() => {
        if (pic != playerState.musicInfo.pic) return
        setPic(picUrl)
      })
      // 主色提取（AM 播放页氛围渐变；原生返回平台对象，取 dominant→average 兜底；
      // defaultColor 为原生取色失败兜底；headers 与可见封面请求一致；失败告警后回退纯模糊底）
      void getColors(picUrl, { defaultColor: '#2288cc', cache: true, headers: defaultHeaders }).then(result => {
        if (pic != playerState.musicInfo.pic) return
        const tint = result.dominant ?? result.average ?? null
        if (tint) setTint(tint)
      }).catch(err => {
        console.warn('image colors failed', err)
      })
    }
    const handlePicUpdate = () => {
      const pic = playerState.musicInfo.pic
      if (pic && pic != playerState.loadErrorPicUrl) {
        handleUpdatePic(pic)
      } else {
        // 无封面曲目（本地歌/封面加载失败）：清空回默认底，避免残留上一首氛围
        setPic(null)
        setTint(null)
      }
    }
    handlePicUpdate()
    global.state_event.on('playerMusicInfoChanged', handlePicUpdate)
    return () => {
      global.state_event.off('playerMusicInfoChanged', handlePicUpdate)
    }
  }, [enabled])

  return { pic, tint }
}

export default ({ children, coverBg = false }: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  const { pic, tint } = usePlayerCover(coverBg)

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

  const coverComponent = (
    <>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ImageBackground
          style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
          source={pic ? { uri: pic, headers: defaultHeaders } : undefined}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
        >
          <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-content-background'], opacity: 0.76 }}></View>
          {displayTint ? (
            <Animated.View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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
      {coverBg ? coverComponent : solidComponent}
    </>
  )
}
