// 使用统计·播放会话生命周期（2026-11-03 定稿 §四.C，doc/plans/usage-stats-plan.md）。
// 闭会话判定链路（审查 R-I2/I3/I4/I5 修订后口径，本模块实现锚点）：
//   - 自动切歌链=playerEnded（队列播空，service.ts isEmpty 分支）→ playNext(true)
//     → musicToggled；用户跳歌链=playNext/playPrev/选歌 → musicToggled（不经
//     playerEnded）。闭会话顺序无关设计：playerEnded 先关为 complete 并留时间戳；
//     musicToggled 对未关会话按「500ms 内有自然结束标记」归 complete，否则 skip。
//   - play_start 仅在实际出声（playerPlaying）且曲目变化时记一次；同曲暂停恢复/
//     缓冲恢复重复进入 Playing 不重记（审查 R-I2 去重口径，曲目变化=会话边界）。
//   - 退后台不产生 play_end（锁屏续播=音乐 App 主场景，审查 R-I3）；出声累计跨
//     后台延续（BackgroundTimer 采样，暂停/缓冲不计；seek 跳变钳制 2s/拍防跳播
//     虚增时长）。
//   - 杀进程兜底（审查 R-I5）：会话快照节流落盘，启动补记 play_end(interrupt)
//     （由模块入口在队列加载后调用 restoreOrphanSession）。
import BackgroundTimer from 'react-native-background-timer'
import TrackPlayer, { Event as TPEvent } from 'react-native-track-player'
import { getPosition } from '@/plugins/player'
import playerState from '@/store/player/state'
import { getData, removeData, saveData } from '@/plugins/storage'
import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import { playSourceOf } from '@/core/player/playSource'
import { trackUsageEvent, type UsagePayload } from './tracker'

/** 播放会话快照（=play_end 私有载荷减 end_reason；落盘形状即孤儿补记形状）。
 * started_at=会话开启时刻（unix 秒）：孤儿补记透传为事件 ts（审查 I2——补记
 * 归听歌发生日而非启动日，服务端 ±24h 窗内天然合法） */
interface SessionSnapshot {
  song_source: string
  song_id: string
  song_title: string
  song_artist: string
  play_source: string
  online: boolean
  quality: string
  played_ms: number
  started_at: number
}

// 会话快照落盘节拍（每 10 个采样步 ≈10s）；自然结束时间窗（跨监听器次序兜底）
const PERSIST_EVERY_TICKS = 10
const NATURAL_END_WINDOW_MS = 500
const TICK_INTERVAL_MS = 1000
const MAX_TICK_DELTA_S = 2 // seek 跳变钳制（1s 采样步长的 2 倍容差）

let session: SessionSnapshot | null = null
let sessionKey = ''
let voiced = false
let lastPosition: number | null = null
let lastNaturalEndAt = 0
let tickCount = 0
// 采样定时器：会话活跃才起、闭会话清（审查 S2/Arch-S2——常驻每秒跨桥空转纯功耗）
let tickTimer: ReturnType<typeof BackgroundTimer.setInterval> | null = null

// play_source 反推兜底映射单源已抽至 core/player/playSource.ts（2026-11-05 渠道
// 区分批审查 S3，换源弹窗同源消费）；打标入口（搜索/榜单/在线歌单/下载/本地/
// 最近播放/加歌试听/深链/稍后播放带标项）的渠道由 playMusicInfo channel 优先
// 提供（Spotify context 语义：渠道是会话属性不从容器反推）

const payloadOf = (snap: SessionSnapshot): UsagePayload => {
  return {
    song_source: snap.song_source,
    song_id: snap.song_id,
    song_title: snap.song_title,
    song_artist: snap.song_artist,
    play_source: snap.play_source,
    online: snap.online,
    quality: snap.quality,
    played_ms: snap.played_ms,
  }
}

// 在线/本地口径单源：下载列表播放=本地文件（online=false），其余=在线（Q4 维度）。
// PlayMusic 联合含 Download.ListItem（任务体；实际播放链传入 metadata.musicInfo，
// 类型防御性兜底——缺 source 即按 local 计）
const sourceOf = (musicInfo: SY.Player.PlayMusic, listId: string | null): string => {
  if (listId == LIST_IDS.DOWNLOAD || !('source' in musicInfo)) return 'local'
  return String(musicInfo.source)
}

const startTick = (): void => {
  if (tickTimer != null) return
  tickTimer = BackgroundTimer.setInterval(tick, TICK_INTERVAL_MS)
}

const stopTick = (): void => {
  if (tickTimer != null) {
    BackgroundTimer.clearInterval(tickTimer)
    tickTimer = null
  }
  voiced = false
  lastPosition = null
}

const closeSession = (endReason: NonNullable<UsagePayload['end_reason']>): void => {
  if (!session) return
  trackUsageEvent('play_end', { ...payloadOf(session), end_reason: endReason })
  session = null
  sessionKey = ''
  stopTick()
  void removeData(storageDataPrefix.usageSession).catch(() => {})
}

const openSession = (): void => {
  const playMusicInfo = playerState.playMusicInfo
  const musicInfo = playMusicInfo.musicInfo
  if (!musicInfo || !musicInfo.id) return
  // name/singer 为 MusicInfo 系字段（ListItem 任务体无），防御性收窄缺省空串
  const snap: SessionSnapshot = {
    song_source: sourceOf(musicInfo, playMusicInfo.listId),
    song_id: String(musicInfo.id),
    song_title: 'name' in musicInfo ? String(musicInfo.name ?? '') : '',
    song_artist: 'singer' in musicInfo ? String(musicInfo.singer ?? '') : '',
    play_source: playMusicInfo.channel || playSourceOf(playMusicInfo.listId), // `||` 拦空串防兜底被绕过（审查 S1）
    online: playMusicInfo.listId != LIST_IDS.DOWNLOAD,
    quality: playerState.actualQuality ?? '',
    played_ms: 0,
    started_at: Math.round(Date.now() / 1000),
  }
  session = snap
  sessionKey = `${snap.song_source}__${snap.song_id}`
  lastNaturalEndAt = 0 // 新会话开启重置自然结束标记（审查 I3：防上一曲自然窗跨会话误判 complete）
  trackUsageEvent('play_start', payloadOf(snap))
  startTick()
  void saveData(storageDataPrefix.usageSession, snap).catch(() => {})
}

const handlePlaying = (): void => {
  voiced = true
  const playMusicInfo = playerState.playMusicInfo
  const musicInfo = playMusicInfo.musicInfo
  const key = musicInfo && musicInfo.id
    ? `${sourceOf(musicInfo, playMusicInfo.listId)}__${String(musicInfo.id)}`
    : ''
  if (!key) {
    voiced = false
    return
  }
  if (key === sessionKey) return // 同曲恢复出声：续累计不重记（R-I2）
  if (session) closeSession('skip') // 兜底（正常路径已在 musicToggled/playerEnded 闭合）
  openSession()
}

const handlePause = (): void => {
  voiced = false // 会话保持 open（暂停→恢复续累计；退后台同样不闭——R-I3）
}

const handleError = (): void => {
  voiced = false
  closeSession('error')
}

const handleEnded = (): void => {
  lastNaturalEndAt = Date.now()
  closeSession('complete') // 自然播完（含队列播空的最后一首，R-I4 播空路径）
}

// 手动停止闭会话（审查 S3）：stop 链不发 musicToggled（playInfo 对 null 提前
// return）也不发 playerEnded（service.ts track==null 提前 return）——无挂点时
// 停止场景 end_reason 恒失真为 interrupt/skip。用户主动终止归 skip
const handleStop = (): void => {
  closeSession('skip')
}

// 音频焦点被永久抢占（来电/他 App 独占，审查 C2 分流二拍板补挂点）：闭会话记
// interrupt（Q7⑥ §五口径）。transient 短暂让出（导航提示音等）不闭会话。
// RemoteDuck 在 service.ts 有被注释的先例（fork 曾禁其 UI 处理，此处仅消费统计
// 语义不回 UI）；播放器未初始化期订阅失败静默（统计不阻塞宿主）
const handleRemoteDuck = (info: any): void => {
  if (info?.permanent) closeSession('interrupt')
}

const handleMusicToggled = (): void => {
  if (!session) return
  // 自然结束链的 musicToggled 在 playerEnded 之后到达（已闭合则不进本分支）；
  // 时间窗兜底监听器注册次序差异（统计先注册时 playerEnded 先关，后注册时本
  // 分支按窗内标记归 complete）
  if (Date.now() - lastNaturalEndAt <= NATURAL_END_WINDOW_MS) {
    closeSession('complete')
    return
  }
  // Q7⑥ 完播口径（审查 C2 补齐实现）：已听 ≥90% 时长的手动切歌归 complete；
  // duration 不可得（maxPlayTime 未落地/≤0，方案 §四.C4）保守记 interrupt
  const durationSec = playerState.progress.maxPlayTime
  if (durationSec > 0 && session.played_ms >= durationSec * 1000 * 0.9) {
    closeSession('complete')
    return
  }
  closeSession(durationSec > 0 ? 'skip' : 'interrupt')
}

// 采样步：出声态累计 played_ms（getPosition 差值，负跳变钳 0、正跳变钳 2s）；
// 非出声态仅跟位（防恢复出声时把暂停期间的 seek 误计）。未初始化期 getPosition
// reject 走 catch（统计链路静默铁律）
const tick = (): void => {
  void getPosition().then(pos => {
    if (voiced && session && lastPosition != null) {
      const delta = Math.min(Math.max(pos - lastPosition, 0), MAX_TICK_DELTA_S)
      if (delta > 0) {
        session.played_ms += Math.round(delta * 1000)
        if (++tickCount >= PERSIST_EVERY_TICKS) {
          tickCount = 0
          void saveData(storageDataPrefix.usageSession, session).catch(() => {})
        }
      }
    }
    lastPosition = pos
  }).catch(() => {})
}

/** 杀进程孤儿会话补记（R-I5）：启动读取快照按 interrupt 闭合——须在队列加载后、
 * 本进程冷启动会话开启前调用（模块入口编排） */
export const restoreOrphanSession = async(): Promise<void> => {
  let orphan: SessionSnapshot | null = null
  try {
    orphan = (await getData<SessionSnapshot>(storageDataPrefix.usageSession)) ?? null
  } catch {
    orphan = null
  }
  if (!orphan || !orphan.song_id) return
  trackUsageEvent('play_end', { ...payloadOf(orphan), end_reason: 'interrupt' }, orphan.started_at)
  void removeData(storageDataPrefix.usageSession).catch(() => {})
}

/** 播放会话跟踪挂载（须先于 initPlayer 注册——playerEnded 闭会话次序依赖，见
 * 模块入口注释）。采样定时器随会话起停（openSession/startTick，closeSession/
 * stopTick），无会话期零桥调用 */
export const initPlayTracker = (): void => {
  global.app_event.on('playerPlaying', handlePlaying)
  global.app_event.on('playerPause', handlePause)
  global.app_event.on('playerWaiting', handlePause)
  global.app_event.on('playerError', handleError)
  global.app_event.on('playerEnded', handleEnded)
  global.app_event.on('musicToggled', handleMusicToggled)
  global.app_event.on('stop', handleStop)
  try {
    void TrackPlayer.addEventListener(TPEvent.RemoteDuck, handleRemoteDuck)
  } catch {} // 播放器未初始化期订阅异常静默
}
