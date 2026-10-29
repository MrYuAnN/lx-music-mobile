// 直连化接缝（批1；方案 #12 接缝瘦身）：apis(source) 直返 shiyin 直连客户端；
// apiList 注册表/userApi 脚本桥/common.apiSource 键已退役（阶段3）。
// local=本地音乐元数据匹配：下载曲带原曲在线身份（toOldMusicInfo 已 merge onlineInfo），
// 按其 source 路由 lyric/pic→musicSdk 自含、url→shiyin；扫描本地曲无身份 reject，
// 由调用侧跨源搜索链（core/music/local.ts getOtherSourceByLocal）兜底。
import { getShiyinMusicUrl } from '@/core/shiyin/client'

const shiyinApis = (source) => ({
  getMusicUrl(songInfo, type, isRefresh) {
    return getShiyinMusicUrl(source, songInfo, type, isRefresh)
  },
})

const localApis = {
  getMusicUrl(songInfo, type, isRefresh) {
    if (songInfo.source == 'local' || !songInfo.songmid) {
      return { promise: Promise.reject(new Error('source not found')), cancelHttp() {} }
    }
    return getShiyinMusicUrl(songInfo.source, songInfo, type, isRefresh)
  },
  getLyric(songInfo) {
    if (songInfo.source == 'local' || !songInfo.songmid) {
      return { promise: Promise.reject(new Error('source not found')) }
    }
    // 延迟 require 防与 musicSdk/index 的循环 import
    return require('./index').default[songInfo.source].getLyric(songInfo)
  },
  getPic(songInfo) {
    if (songInfo.source == 'local' || !songInfo.songmid) {
      return { promise: Promise.reject(new Error('source not found')) }
    }
    return { promise: require('./index').default[songInfo.source].getPic(songInfo) }
  },
}

/** @type {(source: string) => any} 消费契约按形态分派：url={promise,cancelHttp}、lyric={promise}、pic={promise} */
const apis = source => (source == 'local' ? localApis : shiyinApis(source))

export { apis }
