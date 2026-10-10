import Header from './Header'
import HomeSections from './HomeSections'

// AM-2：抽屉退役后，竖屏首页 = 头部（大标题+双圆钮）+ 首页内容 + 迷你播放条
// （doc/plans/apple-music-redesign.md §3.1）
export default () => {
  return (
    <Header>
      <HomeSections />
    </Header>
  )
}
