// 更新检查（批1 阶段4 改自建 /latest；方案 §七）：单地址 GET https://shiyinbox.top/latest
// → {version, url, note, releases}。404=服务端未发版（全新部署常态）→独立标记 notPublished，
// 由 core/version.ts 映射 isLatest（不复用 0.0.0 错误路径）。下载改跳浏览器（url 交给系统
// 浏览器），应用内 APK 下载/安装链（downloadFile/installApk/ABI 拼装）整链退役。
import { httpFetch } from '@/utils/request'

export const LATEST_URL = 'https://shiyinbox.top/latest'

export const getVersionInfo = async() => {
  const resp = await httpFetch(LATEST_URL, { timeout: 10000 }).promise
  // 404=未发版：返回独立标记，非错误（勿与网络失败混淆）
  if (resp.statusCode == 404) return { notPublished: true }
  if (resp.statusCode != 200) throw new Error(resp.statusMessage || resp.statusCode)
  const info = resp.body
  if (info?.version == null || !info.url) throw new Error('failed')
  return {
    notPublished: false,
    version: info.version,
    url: info.url,
    desc: info.note ?? '',
    history: Array.isArray(info.releases) ? info.releases : [],
  }
}
