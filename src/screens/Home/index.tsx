import { useEffect } from 'react'
import { useHorizontalMode } from '@/utils/hooks'
import PageContent from '@/components/PageContent'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
import { useTrialWelcome } from '@/core/shiyin/activation'


interface Props {
  componentId: string
}


export default ({ componentId }: Props) => {
  const isHorizontalMode = useHorizontalMode()
  // 批2 F.1 首启试用欢迎提示（净屏 pending 消费对齐：AppState active 每次前台消费，轻 toast）
  useTrialWelcome()
  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
    // 启动 push（启动时打开播放页）已上收启动链收尾（core/init P1）：
    // Home 挂载 effect 先于 react-navigation 容器就绪，此处派发必被 isReady 守卫丢弃
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PageContent>
      {
        isHorizontalMode
          ? <Horizontal />
          : <Vertical />
      }
    </PageContent>
  )
}
