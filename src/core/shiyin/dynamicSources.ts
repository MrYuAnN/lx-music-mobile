// 源注册表分发器（批1 阶段2；方案 §六批1）：订阅 sourcesUpdated，把 /config 开启集
// 分发给四页 5 store 重建 sources（各 store 按「开启集 ∩ 能力位」过滤+重建附属结构）。
// init/index.ts 须在 initShiyinConfig 之前调用（首启缓存路径的首次广播即依赖本订阅）。
import { rebuildSources as rebuildLeaderboard } from '@/store/leaderboard/state'
import { rebuildSources as rebuildSearchMusic } from '@/store/search/music/state'
import { rebuildSources as rebuildSearchSonglist } from '@/store/search/songlist/state'
import { rebuildSources as rebuildSonglist } from '@/store/songlist/state'
import { rebuildSources as rebuildHotSearch } from '@/store/hotSearch/state'

let inited = false

export const initDynamicSources = () => {
  if (inited) return
  inited = true
  global.state_event.on('sourcesUpdated', (sources) => {
    const enabled = Object.keys(sources)
    rebuildSearchMusic(enabled)
    rebuildSearchSonglist(enabled)
    rebuildLeaderboard(enabled)
    rebuildSonglist(enabled)
    rebuildHotSearch(enabled)
  })
}
