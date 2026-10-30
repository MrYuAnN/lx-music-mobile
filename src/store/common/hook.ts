import { useEffect, useState } from 'react'
import state from './state'

export const useFontSize = () => {
  const [value, update] = useState(state.fontSize)

  useEffect(() => {
    global.state_event.on('fontSizeUpdated', update)
    return () => {
      global.state_event.off('fontSizeUpdated', update)
    }
  }, [])

  return value
}

export const useStatusbarHeight = () => {
  const [value, update] = useState(state.statusbarHeight)

  useEffect(() => {
    global.state_event.on('statusbarHeightUpdated', update)
    return () => {
      global.state_event.off('statusbarHeightUpdated', update)
    }
  }, [])

  return value
}

export const useComponentIds = () => {
  const [value, update] = useState(state.componentIds)

  useEffect(() => {
    global.state_event.on('componentIdsUpdated', update)
    return () => {
      global.state_event.off('componentIdsUpdated', update)
    }
  }, [])

  return value
}

export const useAssertApiSupport = (source: SY.Source) => {
  const [value, update] = useState(global.sy.qualityList[source] != null || source == 'local')

  useEffect(() => {
    const handleUpdate = () => {
      update(global.sy.qualityList[source] != null || source == 'local')
    }

    // 直连化（批1 阶段3）：源集/qualityList 随 /config 下发变化（apiSourceUpdated 已退役）
    global.state_event.on('sourcesUpdated', handleUpdate)
    return () => {
      global.state_event.off('sourcesUpdated', handleUpdate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return value
}


export const useNavActiveId = () => {
  const [value, update] = useState(state.navActiveId)

  useEffect(() => {
    global.state_event.on('navActiveIdUpdated', update)
    return () => {
      global.state_event.off('navActiveIdUpdated', update)
    }
  }, [])

  return value
}


export const useSourceNames = () => {
  const [value, update] = useState(state.sourceNames)

  useEffect(() => {
    global.state_event.on('sourceNamesUpdated', update)
    return () => {
      global.state_event.off('sourceNamesUpdated', update)
    }
  }, [])

  return value
}

