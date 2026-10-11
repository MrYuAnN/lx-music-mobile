import { memo, useEffect, useRef } from 'react'
import { View, Platform, TouchableOpacity } from 'react-native'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import Text from '@/components/common/Text'
import { scaleSizeW } from '@/utils/pixelRatio'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import { registerCoverSource } from '@/navigation/transitions/coverFly'
import Image from '@/components/common/Image'
import { SPACING } from '@/config/spacing'

const gap = scaleSizeW(15)
export default memo(({ item, index, width, showSource, onPress }: {
  item: ListInfoItem
  index: number
  showSource: boolean
  width: number
  onPress: (item: ListInfoItem, index: number) => void
}) => {
  const theme = useTheme()
  const itemWidth = width - gap
  // 封面飞入源侧（RNN sharedElement fromId 的替代）：挂载时注册测距，push 时实测源矩形
  const sourceRef = useRef<View>(null)
  useEffect(() => {
    if (!item.source) return
    return registerCoverSource(item.id, cb => {
      sourceRef.current?.measureInWindow((x, y, w, h) => {
        cb(w > 0 ? { x, y, width: w, height: h } : null)
      })
    })
  }, [item.id, item.source])

  const handlePress = () => {
    onPress(item, index)
  }
  return (
    item.source
      ? (
          <View style={{ ...styles.listItem, width: itemWidth }}>
            <View style={{ ...styles.listItemImg, backgroundColor: theme['c-content-background'] }}>
              <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
                <View ref={sourceRef} style={{ width: itemWidth, height: itemWidth }}>
                  <Image url={item.img} nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`} style={{ width: itemWidth, height: itemWidth, borderRadius: 4 }} />
                </View>
                { showSource ? <Text style={styles.sourceLabel} size={9} color="#fff" >{item.source}</Text> : null }
              </TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
              <Text style={styles.listItemTitle} numberOfLines={ 2 }>{item.name}</Text>
            </TouchableOpacity>
            {/* <Text>{JSON.stringify(item)}</Text> */}
          </View>
        )
      : <View style={{ ...styles.listItem, width: itemWidth }} />
  )
})

const styles = createStyle({
  listItem: {
    // width: 90,
    margin: SPACING.s10,
  },
  listItemImg: {
    // backgroundColor: '#eee',
    borderRadius: 4,
    marginBottom: SPACING.s6,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sourceLabel: {
    paddingLeft: SPACING.s4,
    paddingBottom: SPACING.s2,
    paddingRight: SPACING.s4,
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  listItemTitle: {
    fontSize: 12,
    // overflow: 'hidden',
    marginBottom: SPACING.s6,
  },
})
