import { useEffect, useState, useRef } from 'react'
import TrackPlayer, { State, Event } from 'react-native-track-player'

/** Get current playback state and subsequent updatates  */
export const usePlaybackState = () => {
  const [state, setState] = useState(State.None)

  useEffect(() => {
    async function setPlayerState() {
      // N2 换装 lovegaoshi fork：getState() → getPlaybackState()
      const playerState = await TrackPlayer.getPlaybackState()
      setState(playerState.state)
    }

    void setPlayerState()

    const sub = TrackPlayer.addEventListener(Event.PlaybackState, data => {
      setState(data.state)
    })

    return () => { sub.remove() }
  }, [])

  return state
}

/**
 * Attaches a handler to the given TrackPlayer events and performs cleanup on unmount
 * @param events - TrackPlayer events to subscribe to
 * @param handler - callback invoked when the event fires
 */
// export const useTrackPlayerEvents = (events, handler) => {
//   const savedHandler = useRef()

//   useEffect(() => {
//     savedHandler.current = handler
//   }, [handler])

//   useEffect(() => {
//     // eslint-disable-next-line no-undef
//     if (__DEV__) {
//       const allowedTypes = Object.values(Event)
//       const invalidTypes = events.filter(type => !allowedTypes.includes(type))
//       if (invalidTypes.length) {
//         console.warn(
//           'One or more of the events provided to useTrackPlayerEvents is ' +
//             `not a valid TrackPlayer event: ${invalidTypes.join("', '")}. ` +
//             'A list of available events can be found at ' +
//             'https://react-native-kit.github.io/react-native-track-player/documentation/#events',
//         )
//       }
//     }

//     const subs = events.map(event =>
//       TrackPlayer.addEventListener(event, payload => savedHandler.current({ ...payload, type: event })),
//     )

//     return () => subs.forEach(sub => sub.remove())
//   }, [events])
// }

const pollTrackPlayerStates = new Set<State>([
  State.Playing,
  State.Buffering,
])
/**
 * Poll for track progress for the given interval (in miliseconds)
 * @param updateInterval - ms interval
 */
export function useProgress(updateInterval: number) {
  const [state, setState] = useState({ position: 0, duration: 0, buffered: 0 })
  const playerState = usePlaybackState()
  const stateRef = useRef(state)
  const isUnmountedRef = useRef(true)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const getProgress = async() => {
    // N2 换装：getPosition/getDuration/getBufferedPosition 并入 getProgress()
    const { position, duration, buffered } = await TrackPlayer.getProgress()
    // After the asynchronous code is executed, if the component has been uninstalled, do not update the status
    if (isUnmountedRef.current) return

    if (
      position === stateRef.current.position &&
      duration === stateRef.current.duration &&
      buffered === stateRef.current.buffered
    ) return

    const state = { position, duration, buffered }
    stateRef.current = state
    setState(state)
  }

  useEffect(() => {
    if (!pollTrackPlayerStates.has(playerState)) return

    void getProgress()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const poll = setInterval(getProgress, updateInterval || 1000)
    return () => { clearInterval(poll) }
  }, [playerState, updateInterval])

  return state
}

export function useBufferProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let isUnmounted = false
    let preBuffered = 0
    let duration = 0
    let interval: ReturnType<typeof setInterval> | null = null

    const clearItv = () => {
      if (!interval) return
      clearInterval(interval)
      interval = null
    }
    const updateBuffer = async() => {
      // N2 换装：getBufferedPosition/getDuration → getProgress()
      const { buffered, duration: _duration } = await TrackPlayer.getProgress()
      if (!duration) {
        duration = _duration
      }
      // console.log('updateBuffer', buffered, duration, buffered > 0, buffered == duration)
      // After the asynchronous code is executed, if the component has been uninstalled, do not update the status
      if (buffered > 0 && buffered == duration) clearItv()
      if (buffered == preBuffered || isUnmounted) return
      preBuffered = buffered
      setProgress(duration ? (buffered / duration) : 0)
    }

    const sub = TrackPlayer.addEventListener(Event.PlaybackState, data => {
      switch (data.state) {
        case State.None:
          // console.log('state', 'None')
          setProgress(0)
          break
        // case State.Ready:
        //   console.log('state', 'Ready')
        //   break
        // case State.Stopped:
        //   console.log('state', 'Stopped')
        //   break
        // case State.Paused:
        //   console.log('state', 'Paused')
        //   break
        // case State.Playing:
        //   console.log('state', 'Playing')
        //   break
        case State.Buffering:
          // console.log('state', 'Buffering')
          clearItv()
          duration = 0
          interval = setInterval(updateBuffer, 1000)
          void updateBuffer()
          break
        // case State.Connecting:
        //   console.log('state', 'Connecting')
        //   break
        // default:
        //   console.log('playback-state', data)
        //   break
      }
    })

    void updateBuffer()
    void TrackPlayer.getPlaybackState().then((state) => {
      if (state.state == State.Buffering) interval = setInterval(updateBuffer, 1000)
    })
    return () => {
      isUnmounted = true
      sub.remove()
      clearItv()
    }
  }, [])

  return progress
}
