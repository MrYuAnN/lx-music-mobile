import { useRef } from 'react'

import Btn from './Btn'
import PlayListPanel, { type PlayListPanelType } from '@/components/player/PlayListPanel'

// AM-3：播放队列入口（面板自抽屉批次产物 PlayListPanel 移植）
export default () => {
  const panelRef = useRef<PlayListPanelType>(null)

  return (
    <>
      <Btn icon="playlist-music" onPress={() => { panelRef.current?.show() }} />
      <PlayListPanel ref={panelRef} />
    </>
  )
}
