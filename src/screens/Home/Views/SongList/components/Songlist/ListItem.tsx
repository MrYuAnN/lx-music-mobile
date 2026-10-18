import { useRef, useEffect, memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { registerCoverSource } from '@/navigation/transitions/coverFly'
import Image from '@/components/common/Image'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { SPACING } from '@/config/spacing'

// 歌单大卡（拍板 8）：方形封面 r8 + 播放次数角标（右上，空值不渲染）+ 13 号双行标题。
// 源角标仅搜索页聚合模式显示（showSource 活参数，搜索页传 true；歌单页不传——顶栏胶囊已示源），
// 源标左上避免与播放角标（右上）重叠；阴影移除（AM 无边框淡投影口径）；
// coverFly 注册保留（详情页封面飞入依赖）。
// 播放次数：各源格式不一，渲染前 String 归一防 number 漏网直显（kw:158 在 0 时产出 number）。
export default memo(({ item, index, width, showSource, onPress }: {
  item: ListInfoItem
  index: number
  width: number
  showSource: boolean
  onPress: (item: ListInfoItem, index: number) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
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
  const playCount = String(item.play_count ?? '').trim()
  const showCount = playCount.length > 0 && playCount != '0'
  return (
    item.source
      ? (
          <View style={{ ...styles.listItem, width }}>
            <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
              <View ref={sourceRef} style={{ ...styles.listItemImg, backgroundColor: theme['c-content-background'] }}>
                <Image url={item.img} nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`} style={{ width, height: width, borderRadius: 8 }} />
                {
                  showSource
                    ? <Text style={styles.sourceLabel} size={9} color="#fff">{t(`source_short_${item.source}`)}</Text>
                    : null
                }
                {
                  showCount
                    ? (
                        <View style={styles.countBadge}>
                          <Icon name="play-outline" size={10} color="#fff" />
                          <Text size={11} color="#fff">{playCount}</Text>
                        </View>
                      )
                    : null
                }
              </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
              <Text style={styles.listItemTitle} numberOfLines={2}>{item.name}</Text>
            </TouchableOpacity>
          </View>
        )
      : <View style={{ ...styles.listItem, width }} />
  )
})

const styles = createStyle({
  listItem: {
    marginBottom: SPACING.s14,
  },
  listItemImg: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  sourceLabel: {
    paddingLeft: SPACING.s4,
    paddingBottom: SPACING.s2,
    paddingRight: SPACING.s4,
    position: 'absolute',
    top: 0,
    left: 0,
    borderBottomRightRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  countBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 7,
    paddingRight: 7,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  listItemTitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: SPACING.s6,
  },
})
