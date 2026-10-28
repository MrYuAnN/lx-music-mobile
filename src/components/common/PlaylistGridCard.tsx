import { useMemo, useRef } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Text from '@/components/common/Text'
import PlaylistCover from '@/components/common/PlaylistCover'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import CreateListDialog, { type CreateListDialogType } from '@/components/common/CreateListDialog'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n, type Message } from '@/lang'
import { ICON_SIZE, LIST_IDS, LOVE_GRADIENT } from '@/config/constant'
import { BorderWidths } from '@/theme'
import { SPACING } from '@/config/spacing'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'

// 歌单两列网格卡（单源，2026-10-21）：视觉=添加歌曲页「其他歌单」网格卡（歌单广场卡同构：
// 方形封面 r8 + 双行标题 + 可选左上来源角标），MusicAddModal / MusicMultiAddModal 弹窗同构延用。
// 封面三态（2026-10-23 LOVE 纳入自动轨批，方案 love-home-tile-cover.md §D-1）：pic 直出
// （LOVE 走 setting list.lovePic 双键、DEFAULT 走 list.defaultPic，自建/收藏读条目——自动轨产物
// 与自定义封面同指针）；LOVE 无 pic 回退 LOVE_GRADIENT 红渐变白心（封面位品牌语言保留，Q7 拍板）；
// 其余无 pic → PlaylistCover 默认封面。角标仅读语义场景显示（写目标选择场景经只读过滤后恒为本地
// 自建歌单，「本地」标无信息量不显示）。
// 布局纪律（审查 S-3）：组件只管自身内容，行距/列距归调用方容器（rowGap / columnWrapperStyle），
// 不内嵌 marginBottom；不做 memo（审查 S-8：调用链 onPress 均为不稳定引用，memo 恒穿透反成假象）

// 两列网格布局常量与宽度公式（同族单源，审查 S-1：弹窗家族与 AddMusicScreen 共用，防漂移）
export const PLAYLIST_GRID_GAP = SPACING.s12
export const playlistGridWidthOf = (windowWidth: number) =>
  Math.floor((windowWidth - SPACING.s16 * 2 - PLAYLIST_GRID_GAP) / 2)

// 两列网格滚动容器（审查 S-1 再收编：弹窗家族两 List 容器的 styles+ScrollView+gridWidth 归单源，
// 调用方只留各自的数据过滤与行渲染；render prop 供出列宽给 ListItem/新建卡）
export const PlaylistGridScrollView = ({ children }: { children: (gridWidth: number) => React.ReactNode }) => {
  const windowSize = useWindowSize()
  const gridWidth = useMemo(() => playlistGridWidthOf(windowSize.width), [windowSize])

  return (
    <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
      <View style={styles.list} onStartShouldSetResponder={() => true}>
        {children(gridWidth)}
      </View>
    </ScrollView>
  )
}

interface Props {
  item: LX.List.MyListInfo
  width: number
  onPress: (item: LX.List.MyListInfo) => void
  /** 置灰（写场景该歌已存在等）：仅降透明度，点击仍透传由调用方提示 */
  dimmed?: boolean
  showSourceBadge?: boolean
}

export default ({ item, width, onPress, dimmed = false, showSourceBadge = false }: Props) => {
  const theme = useTheme()
  const t = useI18n()
  // DEFAULT/LOVE 封面走 setting 单键（均不在 userLists 条目上，2026-10-18 拍板口径，shelf 同款；
  // LOVE 自动轨产物与自定义封面共用 lovePic 指针，2026-10-23 纳入自动轨批）
  const defaultPic = useSettingValue('list.defaultPic')
  const lovePic = useSettingValue('list.lovePic')
  const collect = 'source' in item ? !!item.source : false
  const pic = item.id == LIST_IDS.DEFAULT ? defaultPic : item.id == LIST_IDS.LOVE ? lovePic : (item as LX.List.UserListInfo).pic
  const isLove = item.id == LIST_IDS.LOVE

  return (
    <TouchableOpacity style={{ width, opacity: dimmed ? 0.4 : 1 }} activeOpacity={0.7} onPress={() => { onPress(item) }}>
      <View style={styles.coverWrap}>
        {
          isLove && !pic
            ? (
                <LinearGradient colors={LOVE_GRADIENT} style={{ width, height: width, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="love-fill" size={width * 0.3} color="#FFFFFF" />
                </LinearGradient>
              )
            : pic
              ? <Image url={pic} style={{ width, height: width, borderRadius: 8 }} resizeMode="cover" />
              : <PlaylistCover id={item.id} size={width} />
        }
        {
          showSourceBadge
            ? (
                <View style={styles.sourceBadge}>
                  <Text size={9} color="#FFFFFF">{collect ? t(`source_short_${(item as LX.List.UserListInfo).source}` as keyof Message) : t('source_short_local')}</Text>
                </View>
              )
            : null
        }
      </View>
      <Text style={styles.name} size={13} color={theme['c-font']} numberOfLines={2}>{item.name}</Text>
    </TouchableOpacity>
  )
}

// 新建歌单卡（网格末尾虚线卡，弹窗家族共享；审查 S-1 收编原两 List.tsx 逐字拷贝）。
// 点击唤起首页同款 CreateListDialog（命名即建 InputSheet，2026-10-21 用户拍板，替代原
// 原位跨行输入旧机制）；创建成功 useMyList 响应式刷新，新歌单出现在网格首位
export const PlaylistGridCreateCard = ({ itemWidth }: { itemWidth: number }) => {
  const theme = useTheme()
  const t = useI18n()
  const dialogRef = useRef<CreateListDialogType>(null)

  return (
    <>
      <TouchableOpacity
        style={{ ...styles.createCard, width: itemWidth, height: itemWidth, borderColor: theme['c-primary-light-200-alpha-700'] }}
        onPress={() => { dialogRef.current?.show() }}
      >
        <Icon name="plus" size={ICON_SIZE.control} color={theme['c-font-label']} />
        <Text style={styles.createLabel} numberOfLines={1} size={13} color={theme['c-font-label']}>{t('list_create')}</Text>
      </TouchableOpacity>
      <CreateListDialog ref={dialogRef} />
    </>
  )
}

const styles = createStyle({
  // 弹窗家族两列网格容器（PlaylistGridScrollView 单源；rowGap 行距归容器，审查 S-3）
  list: {
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    paddingBottom: SPACING.s6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.s14,
  },
  // 封面 Image 自带圆角（不依赖外层 overflow 裁切，规避 Android 平台差异）
  coverWrap: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  sourceBadge: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomRightRadius: 3,
    paddingHorizontal: SPACING.s4,
    paddingBottom: SPACING.s2,
    overflow: 'hidden',
  },
  name: {
    lineHeight: 18,
    marginTop: SPACING.s6,
  },
  createCard: {
    borderRadius: 8,
    borderWidth: BorderWidths.normal1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s6,
  },
  createLabel: {
    marginHorizontal: SPACING.s8,
  },
})
