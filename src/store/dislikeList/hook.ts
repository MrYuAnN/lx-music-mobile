import { useEffect, useState } from 'react'
import { state } from './state'
import { event } from './event'
import { parseDislikeRules, type DislikeRuleItem } from '@/utils/dislikeManage'


export const useRuleNum = () => {
  const [num, setNum] = useState(state.dislikeInfo.musicNames.size + state.dislikeInfo.singerNames.size + state.dislikeInfo.names.size)

  useEffect(() => {
    const handleUpdate = () => {
      setNum(state.dislikeInfo.musicNames.size + state.dislikeInfo.singerNames.size + state.dislikeInfo.names.size)
    }
    event.on('dislike_changed', handleUpdate)
    return () => {
      event.off('dislike_changed', handleUpdate)
    }
  }, [])

  return num
}

export const useDislikeRules = () => {
  const [rules, setRules] = useState<DislikeRuleItem[]>(() => parseDislikeRules(state.dislikeInfo.rules))

  useEffect(() => {
    const handleUpdate = () => {
      setRules(parseDislikeRules(state.dislikeInfo.rules))
    }
    event.on('dislike_changed', handleUpdate)
    return () => {
      event.off('dislike_changed', handleUpdate)
    }
  }, [])

  return rules
}
