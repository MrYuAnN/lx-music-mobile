import { useRef } from 'react'
import { Animated, View } from 'react-native'
import type { ReactNode } from 'react'
import MusicList from './MusicList'
import { getListCoverPic } from './listCoverSource'
import PageContent from '@/components/PageContent'
import { useActiveListId, useMyList } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'

// 歌单页根容器（歌单页重构批③）：我的歌单侧滑抽屉已退役（拍板 #7，切换走首页 shelf，
// 管理操作并入歌单页 ⋮ 菜单）；原 DrawerLayoutFixed/changeLoveListVisible/nav_love
// fixWidth 事件链一并移除。氛围层随当前激活歌单封面（push 屏与横屏 pane 两形态共用本组件）
// push 形态（壳屏 screens/Mylist）传 showBack/onBack + footer（mini player 占位，须在
// 氛围层内才能被贯通覆盖）；横屏 pane 不传 props，行为不变（方案审查 S2/S5）
// 「我喜欢」氛围源走 lovePic setting 单键（歌单封面机制批②，updateList 对 LOVE 拦截）；
// 「默认歌单」同款 defaultPic（2026-10-18 拍板纳入封面机制）
// scrollY 页面级创建（氛围滚动批 2026-10-19，对齐 SonglistDetail S-1「Value 与消费者同层」）：
// 氛围图块滚走（PageContent）/顶栏渐显/列表 onScroll 三消费者共用一条 Value
export default ({ showBack, onBack, footer }: {
  showBack?: boolean
  onBack?: () => void
  footer?: ReactNode
}) => {
  const lists = useMyList()
  const activeListId = useActiveListId()
  const lovePic = useSettingValue('list.lovePic')
  const defaultPic = useSettingValue('list.defaultPic')
  const scrollY = useRef(new Animated.Value(0)).current
  const activeListInfo = lists.find(l => l.id === activeListId) as LX.List.UserListInfo | undefined
  const ambientPic = getListCoverPic(activeListId, lovePic, defaultPic, activeListInfo)

  return (
    <View style={{ flex: 1 }}>
      <PageContent ambientPic={ambientPic} scrollY={scrollY}>
        <MusicList showBack={showBack} onBack={onBack} scrollY={scrollY} />
        {footer}
      </PageContent>
    </View>
  )
}
