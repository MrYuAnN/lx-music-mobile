import { useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle, type Ref, type JSX } from 'react'
import { StyleSheet, View, Animated } from 'react-native'
// import PropTypes from 'prop-types'
// import { AppColors } from '@/theme'
import { useTheme } from '@/store/theme/hook'
import GlassSurface, { GLASS_BAR_FALLBACK } from '@/components/common/GlassSurface'
import List, { type ItemT, type ListProps, type ListType } from './List'
import { SPACING } from '@/config/spacing'
// import InsetShadow from 'react-native-inset-shadow'

export interface SearchTipListProps<T> extends ListProps<T> {
  onPressBg?: () => void
}
export interface SearchTipListType<T> {
  setList: (list: T[]) => void
  setHeight: (height: number) => void
}

const noop = () => {}

const Component = <T extends ItemT<T>>({ onPressBg = noop, ...props }: SearchTipListProps<T>, ref: Ref<SearchTipListType<T>>) => {
  const theme = useTheme()
  const translateY = useRef(new Animated.Value(0)).current
  const scaleY = useRef(new Animated.Value(0)).current
  const [visible, setVisible] = useState(false)
  const [animatePlayed, setAnimatPlayed] = useState(true)
  const listRef = useRef<ListType<T>>(null)
  const prevListRef = useRef<T[]>([])
  const heightRef = useRef(0)

  useImperativeHandle(ref, () => ({
    setList(list) {
      if (prevListRef.current.length) {
        if (!list.length) handleHide()
      } else if (list.length) handleShow()
      prevListRef.current = list
      requestAnimationFrame(() => {
        listRef.current?.setList(list)
      })
    },
    setHeight(height) {
      heightRef.current = height
    },
  }))


  const handleShow = useCallback(() => {
    // console.log('handleShow', height, visible)
    if (!heightRef.current) return
    setVisible(true)
    setAnimatPlayed(false)
    requestAnimationFrame(() => {
      translateY.setValue(-heightRef.current / 2)
      scaleY.setValue(0)

      Animated.parallel([
      // Animated.timing(fade, {
      //   toValue: 1,
      //   duration: 300,
      //   useNativeDriver: true,
      // }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleY, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setAnimatPlayed(true)
      })
    })
  }, [translateY, scaleY])

  const handleHide = useCallback(() => {
    setAnimatPlayed(false)
    Animated.parallel([
      // Animated.timing(fade, {
      //   toValue: 0,
      //   duration: 200,
      //   useNativeDriver: true,
      // }),
      Animated.timing(translateY, {
        toValue: -heightRef.current / 2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start((finished) => {
      // console.log(finished)
      if (!finished) return
      setVisible(false)
      setAnimatPlayed(true)
    })
  }, [translateY, scaleY])


  const component = useMemo(() => (
    <Animated.View
      style={{
        ...styles.anima,
        transform: [
          { translateY },
          { scaleY },
        ],
      }}>
      {/* 玻璃垫层（2026-10-20 真机反馈：白底+硬阴影与毛玻璃顶栏体系割裂，换 GlassSurface 同材质；
          两调用方=列表内搜索定位浮层/搜索页联想，均贴玻璃顶栏使用） */}
      <View style={styles.container}>
        <GlassSurface style={StyleSheet.absoluteFill} hairline="bottom" fallbackColor={theme.isDark ? GLASS_BAR_FALLBACK.dark : GLASS_BAR_FALLBACK.light} />
        <List ref={listRef} {...props} />
      </View>
      <View style={styles.blank} onTouchStart={onPressBg}></View>
    </Animated.View>
  ), [onPressBg, props, scaleY, theme, translateY])

  return !visible && animatePlayed ? null : component
}

export default forwardRef(Component) as
  <T,>(p: SearchTipListProps<T> & { ref?: Ref<SearchTipListType<T>> }) => JSX.Element | null

const styles = StyleSheet.create({
  anima: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '100%',
    zIndex: 10,
  },
  container: {
    flex: 0,
    // flexGrow: 0,
    // borderBottomWidth: BorderWidths.normal,
    // elevation 硬阴影随玻璃化移除（分界语义交 hairline，对齐顶栏玻璃）
    // 上下留白（2026-10-20 真机反馈：行贴玻璃边无呼吸）
    paddingTop: SPACING.s8,
    paddingBottom: SPACING.s8,
    maxHeight: '80%',
  },
  blank: {
    flex: 1,
    flexGrow: 1,
    // backgroundColor: 'transparent',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
})
