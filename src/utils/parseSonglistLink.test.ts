// parseSonglistLink 单测（2026-11-04 ⑦拍板 tx 宽松兜底批；A5 批次 jest 单轨迁移
// 2026-11-05，运行：npm test；断言自 node:test 版原样平移，语义零变化）
// 覆盖口径：具体形态正则（RESTful/taoge/playlist.html 实链）+ 函数层兜底（y.qq.com
// 子域 id=纯数字）+ 负例（非 tx 域/无 id）。短链展开路径依赖真实网络，不在单测覆盖
// （兜底只作用于展开成功的长链或非短链直链，短链未展开不应用兜底——见实现注释）
import { parseSonglistLink } from './parseSonglistLink.ts'

test('tx 新版分享实链（playlist.html?id=，2026-11-04 用户实测漏网形态）走兜底', async() => {
  const link = await parseSonglistLink(
    'https://i2.y.qq.com/n3/other/pages/details/playlist.html?platform=11&appshare=android_qq&appversion=20090508&hosteuin=oK6kowEAoK4z7eEFNK4A7eCF7v**&id=7804952320&ADTAG=qfshare',
  )
  expect(link).toEqual({ source: 'tx', id: '7804952320' })
})

test('tx RESTful 长链走具体形态正则（非兜底）', async() => {
  const link = await parseSonglistLink('https://y.qq.com/n/ryqq/playlist/7217720898')
  expect(link).toEqual({ source: 'tx', id: '7217720898' })
})

test('tx 旧版 yqq 路径与 taoge.html 分享页', async() => {
  expect(
    await parseSonglistLink('https://y.qq.com/n/yqq/playlist/123456.html'),
  ).toEqual({ source: 'tx', id: '123456' })
  expect(
    await parseSonglistLink('https://i.y.qq.com/n2/m/share/details/taoge.html?platform=11&appshare=android_qq&id=7217720898&ADTAG=qfshare'),
  ).toEqual({ source: 'tx', id: '7217720898' })
})

test('文案混排提取首个 URL 且容忍尾随标点', async() => {
  const link = await parseSonglistLink('分享给你 https://i2.y.qq.com/n3/other/pages/details/playlist.html?id=7804952320。')
  expect(link).toEqual({ source: 'tx', id: '7804952320' })
})

test('兜底域限定：y.qq.com 裸域与子域命中，非 tx 域不命中', async() => {
  expect(await parseSonglistLink('https://y.qq.com/n3/other/pages/details/playlist.html?id=42')).toEqual({ source: 'tx', id: '42' })
  expect(await parseSonglistLink('https://example.com/pages/details/playlist.html?id=42')).toBeNull()
  expect(await parseSonglistLink('https://evil-y.qq.com.example.com/x?id=42')).toBeNull()
})

test('域内非歌单页带 id= 兜底命中为已知接受（与歌单广场入口 SDK 口径同构）', async() => {
  expect(
    await parseSonglistLink('https://y.qq.com/n/ryqq/albumDetail/xxx?id=99'),
  ).toEqual({ source: 'tx', id: '99' })
})

test('id 非纯数字不命中兜底', async() => {
  expect(await parseSonglistLink('https://i2.y.qq.com/n3/other/pages/details/playlist.html?id=abc')).toBeNull()
})

test('无 URL 文本返回 null', async() => {
  expect(await parseSonglistLink('随便一段文字')).toBeNull()
})
