// 五源歌单链接解析（歌单链接导入批，方案 doc/plans/playlist-link-import.md §三.1）：
// 从粘贴文本（常为「文案+链接」混排）中以 https?:// 前缀提取 URL（多条取首个），
// 按源正则解析 { source, id }；未命中且命中短链域名时走 fetch 重定向展开（GoMusic
// 同款先例，方案 R1；实施门禁已过：163cn.tv 实链 response.url 实证返回最终长链）。
// 参照声明（方案 §二 如实留档）：wy/tx 长链形态参照 GoMusic；短链展开仅 wy 有先例，
// tx 可展开性走查实测；kg/kw/mg 无业界对标，按各平台 App 实际分享产物实测自定。
export interface ParsedSonglistLink {
  source: SY.OnlineSource
  id: string
}

// 短链域名清单（每条标注来源与实取日期，kg/kw/mg 走查实测后补齐）
const SHORT_LINK_DOMAINS: ReadonlyArray<{ host: string, source: SY.OnlineSource }> = [
  { host: '163cn.tv', source: 'wy' }, // 网易云 App「复制链接」产物，GoMusic README 实链验证 2026-10-20
  { host: 'c6.y.qq.com', source: 'tx' }, // QQ 音乐 App 分享短链域名（可展开性待真机走查实测）
]

// wy：playlist?id=（PC 网页版地址栏为 hash 路由 #/playlist?id=，代码审查 C1 补；
// 触屏版 y.music.163.com/m/playlist 与 music.163.com/m/playlist 双域并存）
const WY_PATTERNS: readonly RegExp[] = [
  /music\.163\.com\/(?:#\/)?playlist\?[^#]*\bid=([\w-]+)/,
  /(?:y\.music|music)\.163\.com\/m\/playlist\?[^#]*\bid=([\w-]+)/,
]

// tx：n/ryqq（新版）与 n/yqq（旧版）RESTful 双路径并存；i.y.qq.com taoge.html 为
// App 分享详情页形态（代码审查 I3，GoMusic qqmusic.go details 分支核实补）
const TX_PATTERNS: readonly RegExp[] = [
  /y\.qq\.com\/n\/(?:ryqq|yqq)\/playlist\/([\w-]+)/,
  /y\.qq\.com\/[^#]*taoge\.html\?[^#]*\bid=([\w-]+)/,
]

const KG_PATTERNS: readonly RegExp[] = [
  /kugou\.com\/yy\/special\/single\/([\w-]+)\.html/,
  /m\.kugou\.com\/plist\/list\/(\d+)/,
]

const KW_PATTERNS: readonly RegExp[] = [
  /kuwo\.cn\/play_list\/(\d+)/,
  /kuwo\.cn\/playlist\?[^#]*\bid=([\w-]+)/,
]

// mg：v3 路径式带 /music/ 段、v5 疑似无（代码审查 I4，走查实测收敛）；
// query 式 songlistId 非首参亦须命中（[^#]* 不排 ?）
const MG_PATTERNS: readonly RegExp[] = [
  /music\.migu\.cn\/v\d\/(?:music\/)?playlist\/([\w-]+)/,
  /m\.music\.migu\.cn\/[^#]*[?&]songlistId=([\w-]+)/,
]

const SOURCE_PATTERNS: ReadonlyArray<{ source: SY.OnlineSource, patterns: readonly RegExp[] }> = [
  { source: 'wy', patterns: WY_PATTERNS },
  { source: 'tx', patterns: TX_PATTERNS },
  { source: 'kg', patterns: KG_PATTERNS },
  { source: 'kw', patterns: KW_PATTERNS },
  { source: 'mg', patterns: MG_PATTERNS },
]

const URL_EXTRACTION_RXP = /https?:\/\/[^\s"'<>()（）【】《》，。、]+/i

export const extractFirstUrl = (text: string): string | null => {
  const match = URL_EXTRACTION_RXP.exec(text)
  return match ? match[0] : null
}

const trimTrailingPunct = (url: string): string => {
  return url.replace(/[),.;!?！？；，。）】》]+$/, '')
}

const parseByPatterns = (url: string): ParsedSonglistLink | null => {
  for (const { source, patterns } of SOURCE_PATTERNS) {
    for (const rxp of patterns) {
      const match = rxp.exec(url)
      if (match) return { source, id: match[1] }
    }
  }
  return null
}

// 短链域判定：hostname 精确匹配（子串匹配会误命中 query/path 里碰巧含域名的 URL）
const matchShortLink = (url: string): boolean => {
  try {
    const { hostname } = new URL(url)
    return SHORT_LINK_DOMAINS.some(({ host }) => hostname == host || hostname == `www.${host}`)
  } catch {
    return false
  }
}

// 短链展开：一次 fetch 跟随重定向（RN/Node 均默认 follow），response.url 即最终长链；
// 8s 阈值取业界 fetch 超时惯例区间（方案 §二 留档）；外部 signal 供调用方取消时联动中止
export const expandShortLink = async(url: string, timeoutMs = 8000, signal?: AbortSignal): Promise<string | null> => {
  if (!matchShortLink(url)) return null
  const controller = new AbortController()
  const onExternalAbort = () => { controller.abort() }
  signal?.addEventListener('abort', onExternalAbort)
  const timer = setTimeout(() => { controller.abort() }, timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    return response.url
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

export const parseSonglistLink = async(text: string, signal?: AbortSignal): Promise<ParsedSonglistLink | null> => {
  const rawUrl = extractFirstUrl(text.trim())
  if (!rawUrl) return null
  const url = trimTrailingPunct(rawUrl)
  const direct = parseByPatterns(url)
  if (direct) return direct
  const expanded = await expandShortLink(url, undefined, signal)
  if (!expanded) return null
  return parseByPatterns(trimTrailingPunct(expanded))
}
