import { memo, useMemo, useRef, useState, type ComponentRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import Text, { FontFamilies } from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import QualityTag, { getOnlineQualitys, getTintBackground } from '@/components/common/QualityTag'
import DotsVertical from '@/components/common/DotsVertical'
import { useTheme } from '@/store/theme/hook'
import { useAssertApiSupport } from '@/store/common/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { LIST_ITEM_HEIGHT, ICON_SIZE, LOVE_COLOR } from '@/config/constant'
import { createStyle, type RowInfo } from '@/utils/tools'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'
import { hapticImpactLight } from '@/utils/haptic'

export const ITEM_HEIGHT = scaleSizeH(LIST_ITEM_HEIGHT)

// 长按待命拾起位移阈值平方（12dp 初值，真机校准；≈iOS allowableMovement 10pt 同量级，方案 §二 留档）
const DRAG_ACTIVATE_OFFSET_SQ = 12 * 12

// 排行榜前三序号 token（c-chart-1/2/3 金银铜，见 theme/themes/index.ts）；
// 封闭三元组 + 模板下标取值，避免 `c-chart-${n}` 动态键破坏 ActiveTheme 字面量类型
const CHART_COLOR_KEYS = ['c-chart-1', 'c-chart-2', 'c-chart-3'] as const

// 行按压高亮（毛玻璃全体系阶段一行微交互，方案 §1）：高亮底色无位移、内容不随按压减淡
// （activeOpacity 恒 1，按压反馈全交底色，AM 列表行同构）；数值自定待真机校准（审查 S-c）
const PRESSED_BACKGROUND = {
  light: 'rgba(0, 0, 0, 0.06)',
  dark: 'rgba(255, 255, 255, 0.12)',
}

// 全应用唯一歌曲行（问题 1 拍板收敛）：leading 槽（序号 26 / 封面 40×40 r6 / 播放中 play-outline）
// + 主列两行（歌名 15 / [音质+来源标签] 歌手·专辑 12）+ 尾部（时长 12 + 红心 + 竖三点）。
// local 行降级：无 _qualitys 不渲染标签、无 picUrl 走 icon 占位、时长可进副行（showSublineInterval）
export default memo(({ item, index, rowInfo, selectedList, showIndex, rankBadge = false, showCover, showSource, showInterval, showSublineInterval, activeIndex = -1, isLiked = false, qualityOverride, downloaded = false, onLikePress, onPress, onLongPress, onShowMenu, addAction, added = false, dragEnabled = false, onDragStart, onDragMove, onDragRelease, onDragCancel }: {
  item: LX.Music.MusicInfo
  index: number
  rowInfo: RowInfo
  selectedList: LX.Music.MusicInfo[]
  showIndex: boolean
  /** 排行榜前三金银铜徽章开关（显式化，三席审查 S-F：此前隐含「showIndex=true 恒榜单场景」的注释约定，无类型约束） */
  rankBadge?: boolean
  showCover: boolean
  showSource: boolean
  showInterval: boolean
  showSublineInterval?: boolean
  activeIndex?: number
  isLiked?: boolean
  /** 显式音质标签（下载管理已完成行按实际下载档显示） */
  qualityOverride?: LX.Music._MusicQualityType
  /** 已下载角标（2026-10-29 ①-4：歌单/搜索/排行榜/收藏统一标记，对标 Apple Music⭕↓/Spotify；
   * memo comparator 已入比较项，宿主从 useDownloadedSet 取值传入） */
  downloaded?: boolean
  onLikePress?: (item: LX.Music.MusicInfo, isLiked: boolean) => void
  onPress: (item: LX.Music.MusicInfo, index: number) => void
  onLongPress?: (item: LX.Music.MusicInfo, index: number) => void
  /** 行菜单（⋮）。缺省且无 addAction 时不渲染尾部钮 */
  onShowMenu?: (item: LX.Music.MusicInfo, index: number, position: { x: number, y: number, w: number, h: number }) => void
  /** 尾部「+ 添加」动作（添加歌曲页专用，方案 playlist-search-add-music §A2）：存在时替换 ⋮ 槽位；
   * added=true 显示已添加 ✓ 态。调用方以 useCallback 保持引用稳定（comparator 引用比较） */
  addAction?: (item: LX.Music.MusicInfo) => void
  added?: boolean
  /** 拖拽排序手势开关（歌单链接导入同批方案 playlist-drag-reorder §三.1）：默认 false，既有消费方零变化。
   * true 时行级长按改分阶段判定（方案拍板 #1/R2）：长按到点即震+待命（反馈时点与现状一致），
   * 松手走 onLongPress（宿主多选，现状不变）；位移超阈值且宿主 allowDrag → onDragStart 拾起拖拽 */
  dragEnabled?: boolean
  onDragStart?: (item: LX.Music.MusicInfo, index: number, absoluteY: number) => void
  onDragMove?: (absoluteY: number) => void
  onDragRelease?: () => void
  onDragCancel?: () => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const isSupported = useAssertApiSupport(item.source)

  const isSelected = selectedList.includes(item)
  const active = activeIndex == index

  const moreButtonRef = useRef<ComponentRef<typeof TouchableOpacity>>(null)
  const handleShowMenu = () => {
    if (!onShowMenu) return
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

  const [pressed, setPressed] = useState(false)

  // 拖拽排序分阶段手势（方案 playlist-drag-reorder §三.1，仅 dragEnabled 挂载，默认路径零变化）：
  // LongPress 到点（平台默认时长）→ 震动+待命（R2：反馈时点与现状一致）；待命态松手 → onLongPress
  // （宿主多选，现状不变）；待命态位移超阈值（12dp²，≈iOS allowableMovement 10pt 同量级）→ Pan
  // 激活转拖拽。onFinalize 统一收尾：success=松手落位 / false=系统打断 touch cancel（审查 I5 分支）。
  //
  // 线程模型（代码审查 A-C1/优化 S-1 修正）：显式 .runOnJS(true) 把 JS 回调钉死 JS 线程——防后续
  // 改链式写法被 worklets 插件自动 workletize 后在 UI 线程直调 JS 闭包抛错；onTouches* 恒 UI 线程
  // （worklet），shared value 判定与 sm.activate() 留在 UI 侧。
  //
  // gesture 恒稳定化（代码审查 PM-C1）：构建依赖剥离 item/index/回调——跨行重排会改被拖行 index，
  // gesture 若随之重建将取消进行中手势（拖拽一动即断）；实时参数经 dragCallbacksRef 拨正。
  // LongPress maxDist 维持默认：仅激活前检查（激活前超距 fail=让位滚动，预期行为；激活后不查），
  // 不与 12dp 激活阈值冲突（审查 A-C3 不采纳，PM 席 RNGH 官方文档证伪）。
  const dragPending = useSharedValue(false)
  const dragActive = useSharedValue(false)
  // 拾起判定已决标志（activate 工作线程同步置位；onStart 的 dragActive 置位在 JS 线程有帧差，
  // LongPress.onEnd 防御读它防「落位后误进多选」收尾顺序竞态——审查 A-I5）
  const dragDecided = useSharedValue(false)
  const dragOrigin = useSharedValue({ x: 0, y: 0 })
  const dragCallbacksRef = useRef({ item, index, onLongPress, onDragStart, onDragMove, onDragRelease, onDragCancel })
  dragCallbacksRef.current = { item, index, onLongPress, onDragStart, onDragMove, onDragRelease, onDragCancel }
  const dragGestures = useMemo(() => {
    const longPress = Gesture.LongPress()
      .runOnJS(true)
      .onStart(() => {
        dragPending.value = true
        hapticImpactLight()
      })
      .onEnd((_e, success) => {
        const wasPending = dragPending.value
        dragPending.value = false
        const { item: dragItem, index: dragIndex, onLongPress: onLongPressLatest } = dragCallbacksRef.current
        if (wasPending && !dragActive.value && !dragDecided.value && success) onLongPressLatest?.(dragItem, dragIndex)
      })
    const pan = Gesture.Pan()
      .manualActivation(true)
      .runOnJS(true)
      .onTouchesDown((e) => {
        // 多指第二指不重置判定基准（审查 A-S2）：已激活/已决时忽略后续触点
        if (dragActive.value || dragDecided.value) return
        const touch = e.allTouches[0]
        if (touch) dragOrigin.value = { x: touch.absoluteX, y: touch.absoluteY }
        dragDecided.value = false
      })
      .onTouchesMove((e, sm) => {
        if (!dragPending.value || dragDecided.value) return
        const touch = e.allTouches[0]
        if (!touch) return
        const dx = touch.absoluteX - dragOrigin.value.x
        const dy = touch.absoluteY - dragOrigin.value.y
        if (dx * dx + dy * dy >= DRAG_ACTIVATE_OFFSET_SQ) {
          dragDecided.value = true
          sm.activate()
        }
      })
      .onStart((e) => {
        dragActive.value = true
        const cb = dragCallbacksRef.current
        cb.onDragStart?.(cb.item, cb.index, e.absoluteY)
      })
      .onUpdate((e) => {
        dragCallbacksRef.current.onDragMove?.(e.absoluteY)
      })
      .onFinalize((_e, success) => {
        if (!dragActive.value) return
        dragActive.value = false
        dragDecided.value = false
        const cb = dragCallbacksRef.current
        if (success) cb.onDragRelease?.()
        else cb.onDragCancel?.()
      })
    return Gesture.Simultaneous(longPress, pan)
  }, [dragPending, dragActive, dragDecided, dragOrigin])

  // 排行榜前三徽章 token（拍板#7）：rankBadge 显式开启（当前唯一来源=Leaderboard/MusicList）；
  // index<3 时取金银铜色键，4+ 名/未开启为 null 走普通灰数字
  const chartColorKey = rankBadge && index < 3 ? CHART_COLOR_KEYS[index] : null

  let subline = item.singer || t('singer_unknown')
  // 专辑副行恒显（2026-10-22 治理批 P7-c：删 list.isShowAlbumName 开关，全局恒显）
  if (item.meta?.albumName) subline += ` · ${item.meta.albumName}`
  if (showSublineInterval && item.interval) subline += ` · ${item.interval}`

  const rowElement = (
    <View style={{ ...styles.listItem, width: rowInfo.rowWidth, height: ITEM_HEIGHT, backgroundColor: isSelected ? theme['c-primary-background-hover'] : pressed ? PRESSED_BACKGROUND[theme.isDark ? 'dark' : 'light'] : 'rgba(0,0,0,0)', opacity: isSupported ? 1 : 0.5 }}>
      <TouchableOpacity style={styles.main} activeOpacity={1} onPressIn={() => { setPressed(true) }} onPressOut={() => { setPressed(false) }} onPress={() => { onPress(item, index) }} onLongPress={dragEnabled ? undefined : () => { onLongPress?.(item, index) }}>
        {
          showIndex
            ? (
                active
                  ? (
                      // 播放中整槽让位播放图标（拍板 I-5）：徽章/数字均不显示；不沿用旧 sn 样式
                      // （width 定宽会非均匀拉伸 Svg），改容器居中
                      <View style={styles.snView}>
                        <Icon name="play-outline" size={ICON_SIZE.inline} color={theme['c-primary-font']} />
                      </View>
                    )
                  : chartColorKey
                    ? (
                        // 排行榜前三淡底徽章（拍板#7）：22×22/r7、底=色12%（复用音质标签淡底）、数字 13/600
                        <View style={styles.snView}>
                          <View style={{ ...styles.snBadge, backgroundColor: getTintBackground(theme[chartColorKey]) }}>
                            <Text style={styles.snBadgeText} size={13} color={theme[chartColorKey]}>{index + 1}</Text>
                          </View>
                        </View>
                      )
                    : <Text style={styles.snText} size={13} color={theme['c-300']}>{index + 1}</Text>
              )
            : null
        }
        {
          showCover
            ? (
                item.meta?.picUrl
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
            {
              downloaded
                ? <Icon name="download-2" size={ICON_SIZE.inline} color={theme['c-primary']} style={styles.downloadedBadge} />
                : null
            }
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
      {
        addAction
          ? (
              // 「+ 添加/已添加 ✓」（添加歌曲页）：存在时替换 ⋮ 槽位（方案 §A2，审查 I-4）
              <TouchableOpacity style={styles.moreButton} activeOpacity={0.6} onPress={() => { addAction(item) }}>
                <Icon name={added ? 'checkbox-marked' : 'plus'} size={ICON_SIZE.list} color={added ? theme['c-primary'] : theme['c-250']} />
              </TouchableOpacity>
            )
          : onShowMenu
            ? (
                <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
                  <DotsVertical color={theme['c-250']} />
                </TouchableOpacity>
              )
            : null
      }
    </View>
  )
  if (!dragEnabled) return rowElement
  // 拖拽路径：手势层接管长按（TouchableOpacity onLongPress 已卸载防双触发），松手/位移分流见 dragGestures
  return <GestureDetector gesture={dragGestures}>{rowElement}</GestureDetector>
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.showIndex === nextProps.showIndex &&
    prevProps.rankBadge === nextProps.rankBadge &&
    prevProps.showCover === nextProps.showCover &&
    prevProps.showSource === nextProps.showSource &&
    prevProps.showInterval === nextProps.showInterval &&
    prevProps.showSublineInterval === nextProps.showSublineInterval &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.qualityOverride === nextProps.qualityOverride &&
    prevProps.downloaded === nextProps.downloaded &&
    prevProps.activeIndex != nextProps.index &&
    nextProps.activeIndex != nextProps.index &&
    prevProps.addAction === nextProps.addAction &&
    prevProps.added === nextProps.added &&
    prevProps.dragEnabled === nextProps.dragEnabled &&
    prevProps.onDragStart === nextProps.onDragStart &&
    prevProps.onDragMove === nextProps.onDragMove &&
    prevProps.onDragRelease === nextProps.onDragRelease &&
    prevProps.onDragCancel === nextProps.onDragCancel &&
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
  snText: {
    width: 32,
    textAlign: 'center',
    fontFamily: FontFamilies.medium,
    fontVariant: ['tabular-nums'],
  },
  snView: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snBadgeText: {
    fontFamily: FontFamilies.semibold,
    fontVariant: ['tabular-nums'],
    // includeFontPadding:false + lineHeight 对齐盒高 + textAlign 居中，修 Android 小字号在徽章内偏上偏左（QualityTag 同款）
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
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
  downloadedBadge: {
    marginRight: SPACING.s4,
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
