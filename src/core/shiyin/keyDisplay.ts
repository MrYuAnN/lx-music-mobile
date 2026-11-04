// 权益到期展示纯函数族（A5 批次定稿落点，2026-11-05；方案 doc/plans/a5-display-test-net.md）：
// 码卡排序/过期判定（T4 收编批件7 先造，2026-11-04）+ 本地回落视图聚合/六规则①过滤
// （自 MyKeys 组件内联平移）+ 横幅归因/临期文案（自 ExpiryBanner 组件内联平移）+ soon
// 窗判定（自 activation.ts 下沉）——同一语义域（0=永久、validKeys 真值、shiyin 遮蔽、
// 滤红留金）单点，口径演进只看本文件。纯函数零运行时依赖（jest 直跑）；类型单源
// nativeModules/activation 与 '@/lang' Message（均 type-only）；展示注入面（t/formatDate）
// 走参数注入（formatRemainHint 先例）。T4 代码审 S1：isEntryExpired 判定收拢本文件
// 单源（activation.ts re-export 消费——双实现复发防线）
import type { KeyEntry, ActivationStateInfo, EntSourceView } from '@/utils/nativeModules/activation'
import type { Message } from '@/lang'

// 展示注入面 t 的单源签名（审查 S1：三处内联重复收口；activation formatRemainHint 同款消费）
export type TranslateT = (k: keyof Message, p?: Record<string, string | number | boolean>) => string

/** 码级过期判定（validKeys 真值 + 旧桥 expiry 单值兜底，语义族退役后唯一实现）：
 *  真值路径=expiries 非空且 validKeys 空；expiries 空（含 validKeys=[]，旧格式
 *  receipt 空串可达路径，代码审 S-新2/S3）回落 expiry 单值兜底（含 0=永久语义） */
export const isEntryExpired = (e: KeyEntry): boolean => {
  if (e.validKeys != null && Object.keys(e.expiries ?? {}).length > 0) {
    return e.validKeys.length === 0
  }
  return e.expiry != 0 && e.expiry * 1000 <= Date.now()
}

// 码卡两组式排序（方案 activation-expiry-display-plan.md §四B，Q3 拍板对齐 Apple 订阅管理）：
// 生效在上（组内按最近有效到期升序，最快到期顶上；0=永久视为最远→生效组末）/
// 过期沉底（组内按过期时间倒序，最近过期顶上）。码级过期判定=上方 isEntryExpired
// （validKeys 真值，T4 件7 bridge 下发；旧桥窗口退化为 expiry 单值，口径对称）。
// 渲染时计算，跨过期点不自动重排（方案 §五知情登记，重进页收敛；T4 代码审 S2 补登：
// 逐源行过期态快照随同策略，重进页收敛）
export const sortKeyEntries = (entries: KeyEntry[]): KeyEntry[] => {
  const live: KeyEntry[] = []
  const expired: KeyEntry[] = []
  for (const e of entries) (isEntryExpired(e) ? expired : live).push(e)
  const nearestLive = (e: KeyEntry): number => {
    const vals = Object.values(e.expiries ?? {}).filter(exp => exp != 0 && exp * 1000 > Date.now())
    if (!vals.length) {
      // 空 vals 两种成因区分（代码审查 I-2）：expiries 缺失（旧 native 桥窗口）按单值
      // expiry 兜底参与升序（与 isEntryExpired/latestExpired 兜底口径对称，expiry=0
      // 永久→最远）；expiries 在但全永久（无近期到期键）→ 生效组末
      if (!Object.keys(e.expiries ?? {}).length) return e.expiry == 0 ? Infinity : e.expiry
      return Infinity
    }
    return Math.min(...vals)
  }
  const latestExpired = (e: KeyEntry): number => {
    const vals = Object.values(e.expiries ?? {})
    return vals.length ? Math.max(...vals) : e.expiry
  }
  // 比较器恒等回 0（代码审查 S5）：Infinity-Infinity=NaN 依赖引擎按 0 处理的实现行为，
  // 规范未保证——显式恒等分支消除
  live.sort((a, b) => {
    const va = nearestLive(a)
    const vb = nearestLive(b)
    return va === vb ? 0 : va - vb
  })
  expired.sort((a, b) => latestExpired(b) - latestExpired(a))
  return [...live, ...expired]
}

// ---- 到期展示语义族扩展（A5 批次平移，2026-11-05）----

/** 是否即将到期（≤3 天未过期；ExpiryBanner 金色窗，净屏 expiringSoon 同口径）。
 *  A5 批自 activation.ts 单源下沉（本文件唯一实现，activation re-export——同
 *  isEntryExpired 先例防双实现复发）；soon 窗=展示参数留 RN（拍板 I-D）：真值由
 *  调用方以 bridge 下发 valid 传入，窗算术 Date.now() 豁免判定时钟口径拍板 #7 */
export const isExpiringSoonAt = (expiry: number, isValid = true): boolean => {
  if (!isValid || expiry == 0) return false
  return expiry - Math.floor(Date.now() / 1000) <= 3 * 86400
}

export interface BannerPick {
  exp: number
  expired: boolean
}

/** 横幅归因（方案 activation-expiry-display-plan.md §四A 滤红留金口径，2026-11-03 审查
 *  C-1 修订）：T4 收编批真值消费：pool=bridge 下发 masked 遮蔽视图（SDK maskApps
 *  单源——shiyin 兜底有效时只留 shiyin 键，原 allCovered 收缩语义恒等）；每键真值=
 *  bridge valid（SDK validAt 单源，原内联时间比较退役）；hasAnyValid（任一键有效）=
 *  混合态红不出（Q2 拍板：有生效码不打全局红灯，过期源续费触点=播放弹窗），滤红留金
 *  只挑最早临期键；全失效→红显最早过期键。旧桥窗口（valid/masked 缺失）不渲染横幅。
 *  组合边界复审已推演：{F,T} 不可达（hasAnyValid 真时红被滤），无死路。
 *  A5 批自 ExpiryBanner.tsx 内联平移（2026-11-05），GLOSSARY 拍板「归因留展示编排层」
 *  不违背——出组件文件≠出展示编排层 */
export const pickBannerApp = (info: ActivationStateInfo): BannerPick | null => {
  if (info.expiries == null || info.valid == null || info.masked == null) return null
  const pool = Object.entries(info.masked)
  const hasAnyValid = Object.values(info.valid).some(Boolean)
  let pick: BannerPick | null = null
  for (const [app, exp] of pool) {
    if (exp == 0) continue // 永久不提醒
    const expired = info.valid[app] !== true
    const soon = !expired && isExpiringSoonAt(exp, true)
    // 滤红留金：有任一生效权益时过期键不参与（红色全局横幅只在全失效态出现）
    if (expired && hasAnyValid) continue
    if (!expired && !soon) continue
    if (pick == null || (expired && !pick.expired) || (expired == pick.expired && exp < pick.exp)) {
      pick = { exp, expired }
    }
  }
  return pick
}

/** 临期文案三档粒度（2026-11-03 用户需求）：剩余<1h=分钟倒计时、<24h=小时倒计时、
 *  1-3 天=日期（此前恒日期粒度，当天到期只显日期不显紧迫度）。分粒度
 *  语义与 KeyInfo keyinfo_remain 对齐；30s tick 现成=倒计时分钟级自动刷新。
 *  2026-11-04 ⑫B 拍板精简：去源归因（详情码卡页可见，11-01 归因展示退役）、1-3 天档
 *  去时分与「即将」字样（'M-D' 短日期，3 天窗内无跨年歧义）——单行不再拥挤。
 *  A5 批自 ExpiryBanner.tsx 内联平移（2026-11-05）；t/dateFormat 改参数注入
 *  （formatRemainHint 先例）——调用方传 global.i18n.t 与 dateFormat，行为不变 */
export const bannerLabel = (
  pick: BannerPick,
  t: TranslateT,
  formatDate: (ms: number, format: string) => string,
): string => {
  if (pick.expired) return t('home_banner_expired')
  const remainSec = pick.exp - Date.now() / 1000
  if (remainSec < 3600) {
    const minutes = Math.max(1, Math.ceil(remainSec / 60))
    return t('home_banner_expiring_minutes', { n: minutes })
  }
  if (remainSec < 86400) {
    const hours = Math.max(1, Math.ceil(remainSec / 3600))
    return t('home_banner_expiring_hours', { n: hours })
  }
  return t('home_banner_expiring', { date: formatDate(pick.exp * 1000, 'M-D') })
}

/** 本地回落视图（serverFailed/服务端视图拉取失败）：getKeyEntries expiries max 口径——
 *  每源行值=max(自身, shiyin 兜底)，段=贡献码单段（start 未知置 0；历史信息本地不可得=空；
 *  paid 段 skuName 置空串走行1「正式」兑底——尾号形态退役，审查 I-3 本地侧同语义）。
 *  配置源集入参=qualityList 键集（六规则①本地回落口径）：非空=仅已配置源；
 *  空集不过滤（首启弱网防闪变，原码卡 S4 同口径），回落 entries expiries 键集。
 *  A5 批自 MyKeys/index.tsx localSources useMemo 内联平移（2026-11-05）；t 注入
 *  （审查 S-1/S-2 同款先例）。渲染时计算，跨过期点不自动收敛（重进页收敛，§五知情登记） */
export const buildLocalSourceViews = (
  entries: KeyEntry[],
  configuredApps: string[],
  t: TranslateT,
): EntSourceView[] => {
  const apps = configuredApps.length
    ? configuredApps
    : Array.from(new Set(entries.flatMap(e => Object.keys(e.expiries ?? {}))))
  const out: EntSourceView[] = []
  for (const app of apps) {
    let expiry: number | null = null
    const segs: EntSourceView['segments'] = []
    for (const e of entries) {
      const own = e.expiries?.[app]
      const fb = app == 'shiyin' ? undefined : e.expiries?.shiyin
      const candidates = [own, ...(app == 'shiyin' ? [] : [fb])].filter((v): v is number => v != null)
      if (!candidates.length) continue
      const agg = candidates.some(v => v == 0) ? 0 : Math.max(...candidates)
      if (expiry == null || (expiry != 0 && (agg == 0 || agg > expiry))) expiry = agg
      segs.push({
        key: e.key,
        skuName: e.isTrial ? t('activation_state_trial') : '',
        kind: e.isTrial ? 'free' : 'paid',
        start: 0,
        end: agg,
        valid: agg == 0 || agg * 1000 > Date.now(),
      })
    }
    if (expiry != null) {
      out.push({ app, expiry, valid: expiry == 0 || expiry * 1000 > Date.now(), segments: segs })
    }
  }
  return out
}

/** 六规则①「仅显示已配置的源」（2026-11-04 真机修复）：服务端视图与本地回落视图统一
 *  按 qualityList 交集过滤（空集不过滤防首启弱网闪变）；shiyin 兜底键恒排除——全源
 *  权益=各源行各自聚合（六规则「无独立全部音源行」，服务端已收口，此处兜底回落路径）。
 *  A5 批自 MyKeys/index.tsx sources useMemo 内联平移（2026-11-05） */
export const filterSourceViews = (raw: EntSourceView[], configuredApps: string[]): EntSourceView[] =>
  raw.filter(src => src.app != 'shiyin' && (configuredApps.length === 0 || configuredApps.includes(src.app)))
