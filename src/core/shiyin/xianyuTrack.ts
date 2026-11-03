// 闲鱼归因点击埋点（F-09 批5，净屏 XianyuTracker 同语义；v1.3 起归宿主不进 SDK=
// 渠道埋点是宿主私货的架构拍板，RN 侧等价物落 src/）。fire-and-forget：失败静默
// 绝不阻塞唤端/建单主链路（净屏裸 Thread 同铁律）；visitor_id 复用 activation
// deviceId（盐化哈希，零新增采集）；5s 超时；身份不缓存点按现取（审查 S-b：
// 原缓存方案触发 require-atomic-updates，取舍注记见 trackXianyuClick 内注释）。
// result 三值（净屏同语义）：scheme=fleamarket:// 唤端发起/fallback=唤端失败降级
// 原链/legacy=itemId 空（解析失败或未就绪）走现状链接。服务端=轻服务 /site/xianyu
// （白名单外取值宽容归一不 400 丢行）。
import { httpFetch } from '@/utils/request'
import { activationModule } from '@/utils/nativeModules/activation'
import { SHIYIN_BASE_URL } from './config'

export type XianyuTrackResult = 'scheme' | 'fallback' | 'legacy'

export const trackXianyuClick = (result: XianyuTrackResult): void => {
  void (async() => {
    // 身份不缓存（埋点=用户点唤端低频，原生 getDeviceId 本地调用微开销）——
    // 原缓存方案触发 require-atomic-updates（await 后写模块级 let）
    const vid = await activationModule.getDeviceId().catch(() => '')
    if (!vid) return
    await httpFetch(`${SHIYIN_BASE_URL}/site/xianyu`, {
      method: 'post',
      timeout: 5000,
      headers: {
        'X-Product': 'shiyin',
        'Content-Type': 'application/json',
      },
      body: { visitor_id: vid, result, source: 'app' },
    }).promise.catch(() => {}) // 静默：埋点失败不重试不上抛（fire-and-forget 铁律）
  })()
}
