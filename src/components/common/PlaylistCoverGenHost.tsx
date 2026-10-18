import { useEffect, useRef, useState } from 'react'
import { Image, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import { defaultHeaders } from '@/components/common/Image'
import { COVER_SIZE, registerCoverCapture } from '@/utils/playlistCoverGen'
import { createStyle } from '@/utils/tools'

// 离屏斜叠渲染宿主（歌单封面机制批①，方案 §2.1-2）：视图位置移出屏幕（left:-9999——
// 禁用 opacity:0/display:none，Android 下截空图已知坑），collapsable=false 防 Android
// 视图优化摘除。等主图 onLoad（+缓冲让辅图赶上）再截，8s 超时判失败走会话退避；
// 真机 spike 首验点：截图非空、辅图探边可见。
const RNImage = Image

const CollageCover = ({ urls, onMainLoaded }: { urls: string[], onMainLoaded: (ok: boolean) => void }) => {
  const size = COVER_SIZE
  const main = Math.round(size * 0.9)
  const sub = Math.round(size * 0.82)
  return (
    <View style={{ ...styles.canvas, width: size, height: size }}>
      {
        urls[2]
          ? (
              <RNImage
                source={{ uri: urls[2], headers: defaultHeaders }}
                style={{ ...styles.sub, width: sub, height: sub, left: size - sub - size * 0.03, top: size - sub - size * 0.03, transform: [{ rotate: '-10deg' }] }}
                resizeMode="cover"
              />
            )
          : null
      }
      {
        urls[1]
          ? (
              <RNImage
                source={{ uri: urls[1], headers: defaultHeaders }}
                style={{ ...styles.sub, width: sub, height: sub, left: size * 0.03, top: size - sub - size * 0.03, transform: [{ rotate: '8deg' }] }}
                resizeMode="cover"
              />
            )
          : null
      }
      <RNImage
        source={{ uri: urls[0], headers: defaultHeaders }}
        style={{ ...styles.main, width: main, height: main, left: (size - main) / 2, top: (size - main) / 2 }}
        resizeMode="cover"
        onLoad={() => { onMainLoaded(true) }}
        onError={() => { onMainLoaded(false) }}
      />
    </View>
  )
}

const PlaylistCoverGenHost = () => {
  const viewRef = useRef<View>(null)
  const [task, setTask] = useState<{ listId: string, picUrls: string[] } | null>(null)
  const settleRef = useRef<((ok: boolean) => void) | null>(null)

  useEffect(() => {
    registerCoverCapture(async(_listId, picUrls) => {
      const ok = await new Promise<boolean>(resolve => {
        settleRef.current = resolve
        setTask({ listId: _listId, picUrls })
        // 硬超时：远程图卡死时不挂队列（判失败走会话退避）
        const timer = setTimeout(() => { settleRef.current = null; resolve(false) }, 8000)
        // Promise resolve 后清理（captureRef 在 ok 后才跑，无需取消 timer 引用）
        void timer
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
                urls={task.picUrls}
                onMainLoaded={ok => {
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
