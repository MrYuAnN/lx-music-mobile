import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import Modal, { type MusicAddModalType as ModalType, type MusicAddModalProps as ModalProps, type SelectInfo } from './MusicAddModal'
import { LIST_IDS } from '@/config/constant'
import settingState from '@/store/setting/state'
import { queueCoverGen } from '@/utils/playlistCoverGen'

export interface MusicAddModalProps {
  onAdded?: ModalProps['onAdded']
}
export interface MusicAddModalType {
  show: (info: SelectInfo) => void
}

export default forwardRef<MusicAddModalType, MusicAddModalProps>(({ onAdded }, ref) => {
  const musicAddModalRef = useRef<ModalType>(null)
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      // LOVE 封面补漏（LOVE 纳入自动轨批）：LOVE 不在 userLists 搭不了 shelf 补漏车，网格卡
      // LOVE 封面位依赖此处触发；仅无指针时 force（三席审查 S-3：逐首加歌反复开关弹窗不重跑；
      // 有指针的产物悬空归 hub 兜底清键、内容变更归防抖链）
      if (!settingState.setting['list.lovePic']) queueCoverGen(LIST_IDS.LOVE, true)
      if (visible) musicAddModalRef.current?.show(listInfo)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          musicAddModalRef.current?.show(listInfo)
        })
      }
    },
  }))

  return (
    visible
      ? <Modal ref={musicAddModalRef} onAdded={onAdded} />
      : null
  )
})
