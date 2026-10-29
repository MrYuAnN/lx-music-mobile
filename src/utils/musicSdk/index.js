import kw from './kw'
import kg from './kg'
import tx from './tx'
import wy from './wy'
import mg from './mg'
// import bd from './bd'
import xm from './xm'
import { versionChars } from './versionChars'


const sources = {
  sources: [
    {
      name: '酷我音乐',
      id: 'kw',
    },
    {
      name: '酷狗音乐',
      id: 'kg',
    },
    {
      name: 'QQ音乐',
      id: 'tx',
    },
    {
      name: '网易音乐',
      id: 'wy',
    },
    {
      name: '咪咕音乐',
      id: 'mg',
    },
    // {
    //   name: '百度音乐',
    //   id: 'bd',
    // },
  ],
  kw,
  kg,
  tx,
  wy,
  mg,
  // bd,
  xm,
}
export default {
  ...sources,
}

export const init = () => {
  const tasks = []
  for (let source of sources.sources) {
    let sm = sources[source.id]
    sm && sm.init && tasks.push(sm.init())
  }
  return Promise.all(tasks)
}


export const searchMusic = async({ name, singer, source: s, limit = 25 }) => {
  const trimStr = str => typeof str == 'string' ? str.trim() : str
  const musicName = trimStr(name)
  const excludeSource = ['xm']
  // 任务存惰性 thunk：push 不发起请求，按批调用才真正发出——修前 push 即激活 promise，
  // 「分批」只延迟收集已在途的响应，对请求发起时序零作用（审查 C-1b）
  const buildTasks = () => {
    const tasks = []
    for (const source of sources.sources) {
      // 注意：跨源搜索/匹配/歌词/封面=SDK 直连免费面（方案 §六），范围独立于 /config 取链开启集——
      // 摘源摘的是「链」，源搜索能力仍在（取链面由换源层 assertApiSupport 收敛，见 core/music/utils.ts:255）
      if (!sources[source.id].musicSearch || source.id == s || excludeSource.includes(source.id)) continue
      tasks.push(() => sources[source.id].musicSearch.search(`${musicName} ${singer || ''}`.trim(), 1, limit).catch(() => null))
    }
    return tasks
  }
  // 分批并发（走查反馈：五源同时并发搜索触发接口限频空结果）+全空重试一轮：
  // 重试必须重建任务重新发起（复用已 settle 的 promise 结果必然相同）；预算守卫——首轮已耗超
  // 7s 放弃重试，防叠加上层 12s 匹配超时被截断（审查 C-1b）
  const runBatched = async() => {
    const tasks = buildTasks()
    const out = []
    for (let i = 0; i < tasks.length; i += 2) {
      out.push(...await Promise.all(tasks.slice(i, i + 2).map(run => run())))
      if (i + 2 < tasks.length) await new Promise(resolve => setTimeout(resolve, 400))
    }
    return out.filter(Boolean)
  }
  const startedAt = Date.now()
  let results = await runBatched()
  if (!results.length && Date.now() - startedAt < 7_000) {
    await new Promise(resolve => setTimeout(resolve, 1500))
    results = await runBatched()
  }
  return results
}

export const findMusic = async(musicInfo) => {
  const { name, singer, albumName, interval, source: s } = musicInfo

  const lists = await searchMusic({ name, singer, source: s, limit: 25 })

  const singersRxp = /、|&|;|；|\/|,|，|\|/
  const sortSingle = singer => singersRxp.test(singer)
    ? singer.split(singersRxp).sort((a, b) => a.localeCompare(b)).join('、')
    : (singer || '')
  const sortMusic = (arr, callback) => {
    const tempResult = []
    for (let i = arr.length - 1; i > -1; i--) {
      const item = arr[i]
      if (callback(item)) {
        delete item.fSinger
        delete item.fMusicName
        delete item.fAlbumName
        delete item.fInterval
        tempResult.push(item)
        arr.splice(i, 1)
      }
    }
    tempResult.reverse()
    return tempResult
  }
  const getIntv = (interval) => {
    if (!interval) return 0
    // if (musicInfo._interval) return musicInfo._interval
    let intvArr = interval.split(':')
    let intv = 0
    let unit = 1
    while (intvArr.length) {
      intv += parseInt(intvArr.pop()) * unit
      unit *= 60
    }
    return intv
  }
  const trimStr = str => typeof str == 'string' ? str.trim() : (str || '')
  const filterStr = str => typeof str == 'string' ? str.replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '') : String(str || '')
  const fMusicName = filterStr(name).toLowerCase()
  const fSinger = filterStr(sortSingle(singer)).toLowerCase()
  const fAlbumName = filterStr(albumName).toLowerCase()
  const fInterval = getIntv(interval)
  const isEqualsInterval = (intv) => Math.abs((fInterval || intv) - (intv || fInterval)) <= 5
  const isEqualsVersionMusicNameChar = (name) => {
    for (const char of versionChars) {
      if (name.includes(char) != fMusicName.includes(char)) return false
    }
    return true
  }
  const isIncludesName = (name) => (fMusicName.includes(name) || name.includes(fMusicName)) && isEqualsVersionMusicNameChar(name)
  const isIncludesSinger = (singer) => fSinger ? (fSinger.includes(singer) || singer.includes(fSinger)) : true
  const isEqualsAlbum = (album) => fAlbumName ? fAlbumName == album : true

  const result = lists.map(source => {
    for (const item of source.list) {
      item.name = trimStr(item.name)
      item.singer = trimStr(item.singer)
      item.fSinger = filterStr(sortSingle(item.singer).toLowerCase())
      item.fMusicName = filterStr(String(item.name ?? '').toLowerCase())
      item.fAlbumName = filterStr(String(item.albumName ?? '').toLowerCase())
      item.fInterval = getIntv(item.interval)
      // console.log(fMusicName, item.fMusicName, item.source)
      if (!isEqualsInterval(item.fInterval)) {
        item.name = null
        continue
      }
      if (item.fMusicName == fMusicName && isIncludesSinger(item.fSinger)) return item
    }
    for (const item of source.list) {
      if (item.name == null) continue
      if (item.fSinger == fSinger && isIncludesName(item.fMusicName)) return item
    }
    for (const item of source.list) {
      if (item.name == null) continue
      if (isEqualsAlbum(item.fAlbumName) && isIncludesSinger(item.fSinger) && isIncludesName(item.fMusicName)) return item
    }
    return null
  }).filter(s => s)
  const newResult = []
  if (result.length) {
    newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.fMusicName == fMusicName && item.interval == interval))
    newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName && item.fSinger == fSinger && item.fAlbumName == fAlbumName))
    newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.fMusicName == fMusicName))
    newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName && item.interval == interval))
    newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.interval == interval))
    newResult.push(...sortMusic(result, item => item.interval == interval))
    newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName))
    newResult.push(...sortMusic(result, item => item.fSinger == fSinger))
    newResult.push(...sortMusic(result, item => item.fAlbumName == fAlbumName))
    for (const item of result) {
      delete item.fSinger
      delete item.fMusicName
      delete item.fAlbumName
      delete item.fInterval
    }
    newResult.push(...result)
  }
  // console.log(newResult)
  return newResult
}
