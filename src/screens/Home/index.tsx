import { useEffect } from 'react'
import { useHorizontalMode } from '@/utils/hooks'
import PageContent from '@/components/PageContent'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
import { useTrialWelcome } from '@/core/shiyin/activation'
import { useOrderReminder } from '@/core/shiyin/orderReminder'
import { useSkusPrefetch } from '@/core/shiyin/skusPrefetch'


interface Props {
  componentId: string
}


export default ({ componentId }: Props) => {
  const isHorizontalMode = useHorizontalMode()
  // 批2 F.1 首启试用欢迎提示（净屏 pending 消费对齐：AppState active 每次前台消费，轻 toast）
  useTrialWelcome()
  // 批3 待支付订单提醒（6h/40h 两次，本地快照判定+AppState active 双触发，审查 I4 挂载拍板）
  useOrderReminder(componentId)
  // 七题 Q1-C 选购页目录预热带（Home 挂载+AppState active 双触发，>1h 节流——点到期横幅
  // 进购买页时缓存新鲜即开即最新）
  useSkusPrefetch()
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
