import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Image, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import { defaultHeaders } from '@/components/common/Image'
import { COVER_SIZE, registerCoverCapture } from '@/utils/playlistCoverGen'
import { createStyle } from '@/utils/tools'

// 离屏斜叠渲染宿主（歌单封面机制批①，方案 §2.1-2）：视图位置移出屏幕（left:-9999——
// 禁用 opacity:0/display:none，Android 下截空图已知坑），collapsable=false 防 Android
// 视图优化摘除。等主图 onLoad（+缓冲让辅图赶上）再截，8s 超时判失败走会话退避；
// 真机 spike 首验点：截图非空、辅图探边可见。
// 本地歌曲 meta.picUrl 可能是裸绝对路径，与远程 uri 同源构造（消费端 Image 同款补全），
// 三席代码审查 S5。nonce 强制重挂：同 uri 复用时不触发 onLoad（S9）。

const toImageSource = (uri: string) => {
  return { uri: uri.startsWith('/') ? `file://${uri}` : uri, headers: defaultHeaders }
}

const CollageCover = ({ urls, onMainLoaded }: { urls: string[], onMainLoaded: (ok: boolean) => void }) => {
  const size = COVER_SIZE
  // AM 斜叠规格（真机反馈 2026-10-18 调参，产物文件名 v2 标签联动 playlistCoverGen.LAYOUT_TAG）：
  // 三卡等大 84% 白描边分层——主图正面居中，两辅图对角探边（位移 3.5% + ±5° 旋转外扩后
  // 单侧可见边约 18~36px，AM 量级）。旧参数（主图 90% 四周空带、辅图 82% 只露歪斜小角
  // 且无描边）层次读不出、观感碎乱。投影不加：elevation 在 view-shot 软渲染下不可靠，白边已足分层
  const card = Math.round(size * 0.84)
  const border = Math.round(size * 0.016)
  const offset = Math.round(size * 0.035)
  const cardPos = (shift: number) => ({
    width: card,
    height: card,
    left: Math.round((size - card) / 2) + shift,
    top: Math.round((size - card) / 2) + shift,
  })
  return (
    <View style={{ ...styles.canvas, width: size, height: size }}>
      {
        urls[1]
          ? (
              <Image
                source={toImageSource(urls[1])}
                style={{ ...styles.sub, ...cardPos(-offset), borderColor: '#FFFFFF', borderWidth: border, transform: [{ rotate: '-5deg' }] }}
                resizeMode="cover"
              />
            )
          : null
      }
      {
        urls[2]
          ? (
              <Image
                source={toImageSource(urls[2])}
                style={{ ...styles.sub, ...cardPos(offset), borderColor: '#FFFFFF', borderWidth: border, transform: [{ rotate: '5deg' }] }}
                resizeMode="cover"
              />
            )
          : null
      }
      <Image
        source={toImageSource(urls[0])}
        style={{ ...styles.main, ...cardPos(0), borderColor: '#FFFFFF', borderWidth: border }}
        resizeMode="cover"
        onLoad={() => { onMainLoaded(true) }}
        onError={() => { onMainLoaded(false) }}
      />
    </View>
  )
}

const PlaylistCoverGenHost = () => {
  const viewRef = useRef<ComponentRef<typeof View>>(null)
  const [task, setTask] = useState<{ listId: string, picUrls: string[] } | null>(null)
  const [nonce, setNonce] = useState(0)
  const settleRef = useRef<((ok: boolean) => void) | null>(null)
  // 8s 超时 timer 必须在 settle 成功路径清理：残留 timer 的到期回调会把下一个任务
  // 挂上的 settleRef 清空，连环误判失败进会话退避（三席代码审查 C1）
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    registerCoverCapture(async(_listId, picUrls) => {
      const ok = await new Promise<boolean>(resolve => {
        settleRef.current = resolve
        setTask({ listId: _listId, picUrls })
        setNonce(n => n + 1)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          settleRef.current = null
          resolve(false)
        }, 8000)
      })
      if (!ok || !viewRef.current) return null
      // 主图就绪后再等一帧+缓冲，辅图大概率已解码（真机 spike 调参点）
      await new Promise<void>(resolve => { setTimeout(resolve, 300) })
      if (!viewRef.current) return null
      return captureRef(viewRef.current, { format: 'png', quality: 1, width: COVER_SIZE, height: COVER_SIZE, result: 'tmpfile' })
    })
    return () => { registerCoverCapture(null) }
  }, [])

  return (
    <View ref={viewRef} collapsable={false} style={styles.offscreen}>
      {
        task
          ? (
              <CollageCover
                key={nonce}
                urls={task.picUrls}
                onMainLoaded={ok => {
                  if (timerRef.current) {
                    clearTimeout(timerRef.current)
                    timerRef.current = null
                  }
                  const settle = settleRef.current
                  if (settle) {
                    settleRef.current = null
                    settle(ok)
                  }
                }}
              />
            )
          : null
      }
    </View>
  )
}

const styles = createStyle({
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },
  canvas: {
    overflow: 'hidden',
  },
  main: {
    position: 'absolute',
  },
  sub: {
    position: 'absolute',
  },
})

export default PlaylistCoverGenHost
