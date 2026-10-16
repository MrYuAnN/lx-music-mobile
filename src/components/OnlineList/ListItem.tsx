import { memo, useRef, type ComponentRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import QualityTag, { getOnlineQualitys } from '@/components/common/QualityTag'
import DotsVertical from '@/components/common/DotsVertical'
import { useTheme } from '@/store/theme/hook'
import { useAssertApiSupport } from '@/store/common/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { LIST_ITEM_HEIGHT, ICON_SIZE, LOVE_COLOR } from '@/config/constant'
import { createStyle, type RowInfo } from '@/utils/tools'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'

export const ITEM_HEIGHT = scaleSizeH(LIST_ITEM_HEIGHT)

// 全应用唯一歌曲行（问题 1 拍板收敛）：leading 槽（序号 26 / 封面 40×40 r6 / 播放中 play-outline）
// + 主列两行（歌名 15 / [音质+来源标签] 歌手·专辑 12）+ 尾部（时长 12 + 红心 + 竖三点）。
// local 行降级：无 _qualitys 不渲染标签、无 picUrl 走 icon 占位、时长可进副行（showSublineInterval）
export default memo(({ item, index, rowInfo, selectedList, showIndex, showCover, showSource, showInterval, showSublineInterval, isShowAlbumName, activeIndex = -1, isLiked = false, qualityOverride, onLikePress, onPress, onLongPress, onShowMenu }: {
  item: LX.Music.MusicInfo
  index: number
  rowInfo: RowInfo
  selectedList: LX.Music.MusicInfo[]
  showIndex: boolean
  showCover: boolean
  showSource: boolean
  showInterval: boolean
  showSublineInterval?: boolean
  isShowAlbumName: boolean
  activeIndex?: number
  isLiked?: boolean
  /** 显式音质标签（下载管理已完成行按实际下载档显示） */
  qualityOverride?: LX.Music._MusicQualityType
  onLikePress?: (item: LX.Music.MusicInfo, isLiked: boolean) => void
  onPress: (item: LX.Music.MusicInfo, index: number) => void
  onLongPress: (item: LX.Music.MusicInfo, index: number) => void
  onShowMenu: (item: LX.Music.MusicInfo, index: number, position: { x: number, y: number, w: number, h: number }) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const isSupported = useAssertApiSupport(item.source)

  const isSelected = selectedList.includes(item)
  const active = activeIndex == index

  const moreButtonRef = useRef<ComponentRef<typeof TouchableOpacity>>(null)
  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }
  const handleLikePress = () => {
    if (!onLikePress) return
    onLikePress(item, isLiked)
  }

  const qualitys = qualityOverride ?? getOnlineQualitys(item)

  let subline = item.singer || t('singer_unknown')
  if (isShowAlbumName && item.meta.albumName) subline += ` · ${item.meta.albumName}`
  if (showSublineInterval && item.interval) subline += ` · ${item.interval}`

  return (
    <View style={{ ...styles.listItem, width: rowInfo.rowWidth, height: ITEM_HEIGHT, backgroundColor: isSelected ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)', opacity: isSupported ? 1 : 0.5 }}>
      <TouchableOpacity style={styles.main} onPress={() => { onPress(item, index) }} onLongPress={() => { onLongPress(item, index) }}>
        {
          showIndex
            ? (
                active
                  ? <Icon style={styles.sn} name="play-outline" size={ICON_SIZE.inline} color={theme['c-primary-font']} />
                  : <Text style={styles.sn} size={13} color={theme['c-300']}>{index + 1}</Text>
              )
            : null
        }
        {
          showCover
            ? (
                item.meta.picUrl
                  ? <Image url={item.meta.picUrl} style={styles.pic} />
                  : (
                      <View style={{ ...styles.pic, ...styles.picPlaceholder, backgroundColor: theme['c-border-background'] }}>
                        <Icon name="music" size={ICON_SIZE.list} color={theme['c-font-label']} />
                      </View>
                    )
              )
            : null
        }
        <View style={styles.info}>
          <Text size={15} style={styles.title} color={active ? theme['c-primary-font'] : theme['c-font']} numberOfLines={1}>{item.name}</Text>
          <View style={styles.sublineRow}>
            <QualityTag qualitys={qualitys} source={item.source} showSource={showSource} />
            <Text size={12} style={styles.sublineText} color={active ? theme['c-primary-alpha-200'] : theme['c-font-label']} numberOfLines={1}>{subline}</Text>
          </View>
        </View>
        {
          showInterval && item.interval
            ? <Text size={12} color={active ? theme['c-primary-alpha-400'] : theme['c-300']} numberOfLines={1}>{item.interval}</Text>
            : null
        }
      </TouchableOpacity>
      {
        onLikePress
          ? (
              <TouchableOpacity style={styles.likeBtn} activeOpacity={0.5} onPress={handleLikePress}>
                <Icon name={isLiked ? 'love-fill' : 'love'} size={ICON_SIZE.list} color={LOVE_COLOR} />
              </TouchableOpacity>
            )
          : null
      }
      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
        <DotsVertical color={theme['c-250']} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.showIndex === nextProps.showIndex &&
    prevProps.showCover === nextProps.showCover &&
    prevProps.showSource === nextProps.showSource &&
    prevProps.showInterval === nextProps.showInterval &&
    prevProps.showSublineInterval === nextProps.showSublineInterval &&
    prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.qualityOverride === nextProps.qualityOverride &&
    prevProps.activeIndex != nextProps.index &&
    nextProps.activeIndex != nextProps.index &&
    nextProps.selectedList.includes(nextProps.item) == prevProps.selectedList.includes(nextProps.item)
  )
})

const styles = createStyle({
  listItem: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s8,
  },
  main: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 26,
    textAlign: 'center',
  },
  pic: {
    width: scaleSizeW(40),
    height: scaleSizeW(40),
    borderRadius: scaleSizeW(6),
    marginLeft: SPACING.s4,
    marginRight: SPACING.s12,
  },
  picPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: SPACING.s6,
  },
  sublineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s2,
  },
  sublineText: {
    flexGrow: 0,
    flexShrink: 1,
    lineHeight: 16,
  },
  title: {
    lineHeight: 20,
  },
  likeBtn: {
    width: 32,
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    width: 36,
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
