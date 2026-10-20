import { FlatList, PanResponder, TouchableOpacity, View, StyleSheet, ScrollView, Animated } from 'react-native'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import LinearGradient from 'react-native-linear-gradient'
import { useTheme } from '@/store/theme/hook'
import { useI18n, type Message } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { allMusicList, getListMusics } from '@/utils/listManage'
import { useRecentPlayList } from '@/core/player/recentPlay'
import { setTempList, setActiveList, updateUserListPosition, updateUserList } from '@/core/list'
import { getListDetail } from '@/core/songlist'
import { playList } from '@/core/player/player'
import { updateSetting } from '@/core/common'
import commonState from '@/store/common/state'
import listState from '@/store/list/state'
import { navigations } from '@/navigation'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { LIST_IDS, storageDataPrefix, ICON_SIZE, LOVE_COLOR, LOVE_GRADIENT } from '@/config/constant'
import Text, { FontFamilies } from '@/components/common/Text'
import CreateListDialog, { type CreateListDialogType } from '@/components/common/CreateListDialog'
import { SPACING } from '@/config/spacing'
import { hapticImpactLight } from '@/utils/haptic'
import { prefetchAmbientColor } from '@/utils/ambientColor'
import { useSettingValue } from '@/store/setting/hook'
import { existsFile } from '@/utils/fs'
import { setDefaultCover } from '@/core/defaultCover'
import { queueCoverGen, syncShelfCovers, isCurrentLayoutPic } from '@/utils/playlistCoverGen'
import { setLoveCover } from '@/core/loveCover'

// AM-6 首页内容：原规格源 .review-bundle/2026-10-10/home-proto.html（v-dense）。
// 2026-10-20 首页改版（快捷格 1×4 +「我喜欢」hero 卡）起，形态与字号以 doc/design-principles.md §7
// 拍板为准；尺寸仍脱离 scaleSize 体系（其 3.1 上限在高密度屏压缩尺寸导致比例失真），直接用 dp 值
// （间距走 SPACING 单源；图标走 ICON_SIZE 语义 token；文字沿用 Text 组件 setSpText 保留用户字号设置）。

const isCollectList = (info: LX.List.MyListInfo): boolean => {
  return 'source' in info ? !!info.source : false
}

// 打开歌单页（模块级单源）：LoveSection 与 PlaylistShelf 共用（LoveCard 从 MyMusic 拆出后两侧各持调用）
const openList = (id: string) => {
  const componentId = commonState.componentIds.home
  if (!componentId) return
  setActiveList(id)
  navigations.pushMylistScreen(componentId)
}

// 存量收藏歌单封面补齐（2026-10-16）：收藏动作落库 pic 之前的旧数据缺封面。对「有源缺图」条目
// 拉歌单详情首页取 info.img 落库（updateUserList 经 list_update 事件持久化并触发重渲染）；
// pending 去重防同帧重复请求，失败静默保留渐变占位、下次进首页自动重试（core/songlist 自带会话级缓存）
const pendingListPics = new Set<string>()
const failedListPics = new Set<string>()
const ensureListPic = async(item: LX.List.UserListInfo) => {
  // 失败会话级退避（代码审查 S-3）：失败 id 本会话不再重试防反复无效请求，冷启动重置恢复「下次进首页重试」语义
  if (item.pic || failedListPics.has(item.id) || !item.source || !item.sourceListId) return
  if (pendingListPics.has(item.id)) return
  pendingListPics.add(item.id)
  try {
    const detail = await getListDetail(item.sourceListId, item.source, 1)
    const pic = detail.info?.img
    if (pic) {
      // 竞态防护（三席审查 #8）：网络等待期条目可能已被重命名/远端同步更新（updateList 对
      // name/source 等字段恒覆盖），写时按 id 重读最新条目仅并 pic，防等待前快照回滚并发编辑
      const fresh = listState.userList.find(l => l.id === item.id)
      if (fresh) await updateUserList([{ ...fresh, pic }])
    }
  } catch {
    failedListPics.add(item.id)
  } finally {
    pendingListPics.delete(item.id)
  }
}

const QuickNav = () => {
  const theme = useTheme()
  const t = useI18n()

  const items: Array<{ id: 'nav_local_music' | 'nav_download' | 'nav_top' | 'nav_songlist', icon: string, action: () => void }> = [
    { id: 'nav_local_music', icon: 'folder-music', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushLocalMusicScreen(componentId) } },
    { id: 'nav_download', icon: 'download-2', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushDownloadScreen(componentId) } },
    { id: 'nav_top', icon: 'trophy', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushLeaderboardScreen(componentId) } },
    { id: 'nav_songlist', icon: 'album', action: () => { const componentId = commonState.componentIds.home; if (componentId) navigations.pushSongListScreen(componentId) } },
  ]

  return (
    <View style={styles.quick}>
      {
        items.map(({ id, icon, action }) => (
          <TouchableOpacity key={id} style={{ ...styles.tile, backgroundColor: theme['c-content-background'] }} activeOpacity={0.6} onPress={action}>
            <Icon name={icon} size={ICON_SIZE.tile} color={theme['c-primary']} />
            <Text style={styles.tileLabel} size={13} color={theme['c-font']} numberOfLines={1}>{t(id)}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )
}

// 歌单封面：无封面数据的用户歌单按 id 稳定取一组渐变 + 音符标
const COVER_GRADIENTS: Array<[string, string]> = [
  ['#FA233B', '#FF7A59'],
  ['#4F46E5', '#9333EA'],
  ['#0EA5E9', '#22D3EE'],
  ['#F59E0B', '#F43F5E'],
  ['#10B981', '#34D399'],
  ['#6366F1', '#EC4899'],
]
const PlaylistCover = ({ id, size }: { id: string, size: number }) => {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const [from, to] = COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length]
  return (
    <View style={{ ...styles.plCover, width: size, height: size, backgroundColor: from }}>
      <View style={{ ...styles.plCoverTo, backgroundColor: to }} />
      <Icon name="music" size={size * 0.34} color="rgba(255,255,255,0.9)" style={styles.plCoverIcon} />
    </View>
  )
}

const RecentPlayCard = () => {
  const theme = useTheme()
  const t = useI18n()
  const recentAll = useRecentPlayList()
  const list = useMemo(() => recentAll.slice(0, 30), [recentAll])

  const handlePlay = async(index: number) => {
    const musicInfos = list.map(item => item.musicInfo)
    await setTempList(storageDataPrefix.TEMP_LIST_RECENT, musicInfos)
    void playList(LIST_IDS.TEMP, index)
  }

  // 空态整块隐藏（含卡头，对标 AM/Spotify 空内容不显示区块；全量入口随之无必要）
  if (!list.length) return null

  const componentId = commonState.componentIds.home
  return (
    <View style={{ ...styles.section, ...styles.card, backgroundColor: theme['c-content-background'] }}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} size={17} color={theme['c-font']}>{t('home_recent_play')}</Text>
        {
          componentId
            ? <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} onPress={() => { navigations.pushRecentPlayScreen(componentId) }}>
                <Text size={13} color={theme['c-font-label']}>{t('more')}</Text>
                <Icon name="chevron-right" size={ICON_SIZE.chevron} color={theme['c-font-label']} />
              </TouchableOpacity>
            : null
        }
      </View>
      <FlatList
        horizontal
        data={list}
        keyExtractor={item => `${item.musicInfo.source}__${item.musicInfo.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelfContent}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.shelfItem} activeOpacity={0.6} onPress={() => { void handlePlay(index) }}>
            <Image
              style={{ ...styles.shelfCover, backgroundColor: theme['c-border-background'] }}
              url={(item.musicInfo.meta as { picUrl?: string }).picUrl ?? null}
              resizeMode="cover"
            />
            <Text style={styles.shelfName} size={13} color={theme['c-font']} numberOfLines={1}>{item.musicInfo.name}</Text>
            <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{item.musicInfo.singer}</Text>
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

// 「我喜欢的音乐」hero 卡（2026-10-20 首页改版拍板）：封面直出+底部深色遮罩（对标 AM Top Picks poster 式
// 封面直出卡，v1 取色渐变方案经审查证伪作废）；无 lovePic 回退 LOVE_GRADIENT 红系渐变（LOVE 语义色族
// 单源 constant.ts）。红系渐变端点/卡高/播放键/遮罩浓度等细目无业界统一规格，本产品自定，真机校准定稿。
// 叠层契约：红渐变恒铺底层、封面 Image 作叠加层——解码空窗/existsFile 异步清键窗口透出渐变，两态无闪变。
// 播放键=显式切全局随机后起播（2026-10-20 拍板，推翻 2026-10-16「固定第一首、无隐藏随机」，
// doc/plans/home-music-section-c.md 已归档标注）；曲数=0 禁用沿用。
// existsFile 缺失兜底清键（lovePic 指向 DocumentDir 文件，清数据/换机后丢失——方案审查 I-a/N2 降级路径）
const LoveSection = () => {
  const t = useI18n()
  const lovePic = useSettingValue('list.lovePic')
  // 曲数读 allMusicList 内存 Map；预载完成不自发事件，事件到达与预载完成后本地 bump 刷新
  const [, setMusicVersion] = useState(0)

  // 冷启动预载 LOVE（真机反馈 2026-10-18：不预载曲数误显 0 且播放键静默失败）。
  // 预载按组件域拆分：本组件只管 LOVE（shelf 侧归 MyMusic，代码审查 I1：useMyList 恒含 LOVE，
  // 不得经 map 隐式带回），getListMusics 内存缓存幂等；预载失败被吞后 effect 不重跑，故借事件
  // bump 补载自持重试路径（拆分后 MyMusic 侧不再隐式兜底 LOVE）
  const preloadLove = useCallback(() => {
    if (allMusicList.has(LIST_IDS.LOVE)) return
    void getListMusics(LIST_IDS.LOVE).catch(() => {}).then(() => {
      setMusicVersion(v => v + 1)
    })
  }, [])

  useEffect(() => {
    const bump = () => {
      preloadLove()
      setMusicVersion(v => v + 1)
    }
    preloadLove()
    global.state_event.on('mylistUpdated', bump)
    global.app_event.on('myListMusicUpdate', bump)
    return () => {
      global.state_event.off('mylistUpdated', bump)
      global.app_event.off('myListMusicUpdate', bump)
    }
  }, [preloadLove])

  useEffect(() => {
    if (!lovePic) return
    let cancelled = false
    void existsFile(lovePic).then(ok => {
      if (!cancelled && !ok) void setLoveCover(null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [lovePic])

  const count = allMusicList.get(LIST_IDS.LOVE)?.length ?? 0
  const canPlay = count > 0

  const handlePlay = () => {
    if (!canPlay) return
    // 顺序契约：先切全局随机、后起播——首曲需以随机语义入 playedList（player.ts handlePlay 按
    // 播放那一刻的模式值入队），反序则随机选曲被 playedList 短路回退「回放历史」；
    // updateSetting 内存同步生效（throttleSave 仅管持久化），随后 playList 即读新值
    updateSetting({ 'player.togglePlayMethod': 'random' })
    void playList(LIST_IDS.LOVE, 0)
  }

  return (
    <TouchableOpacity style={styles.heroCard} activeOpacity={0.8} onPress={() => { openList(LIST_IDS.LOVE) }}>
      <LinearGradient colors={LOVE_GRADIENT} style={StyleSheet.absoluteFill} />
      {
        lovePic
          ? <>
              <Image url={lovePic} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <LinearGradient colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.55)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
            </>
          : null
      }
      <View style={styles.heroContent}>
        <View style={styles.heroInfo}>
          <Icon name="love-fill" size={ICON_SIZE.emphasis} color="#FFFFFF" />
          <View style={styles.heroTexts}>
            <Text style={styles.heroName} size={17} color="#FFFFFF" numberOfLines={1}>{t('list_name_love')}</Text>
            <Text size={13} color="rgba(255, 255, 255, 0.88)" numberOfLines={1}>{t('music_count', { count })}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={{ ...styles.heroPlayBtn, opacity: canPlay ? 1 : 0.35 }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          disabled={!canPlay}
          activeOpacity={0.7}
          onPress={handlePlay}
        >
          <Icon name="play" size={20} color={LOVE_COLOR} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

// 歌单横滑 shelf 长按拖拽排序（C 案 §3，v3 手势规格 + 代码审查 C-1/C-2/I-1 修复）：
// 长按（TouchableOpacity onLongPress，400ms=Android 平台默认长按时长）激活 → 触觉反馈 + 浮起 +
// 内层横滑 scrollEnabled 关闭 → 外层 PanResponder 见激活标志才抢占接管 move（Pressability 让渡后
// onPressOut 不承担落位，由 onPanResponderRelease 统一收口）；静止长按松手（外层未抢占）由
// onPressOut 检测激活态零位移落位。让位=live 占格模型（被拖项实时占据目标格），
// 落位 insertPos = 松手展示位 − 1，clamp ≥ 0（底层只钳上限），默认歌单恒首位（hover 下限 1）。
// PanResponder 回调经 handlersRef 间接调用最新闭包（useRef(create) 只执行一次，直接闭包会捕获
// 首渲染 lists 导致 lists 变化后拖错歌单——审查 C-1）
const SHELF_ITEM_STEP = 96 // 封面 84 + gap 12，调整卡宽/间距需同步
const DRAG_ACTIVATION_MS = 400

const PlaylistShelf = ({ lists, getCount, onOpen }: {
  lists: LX.List.MyListInfo[]
  getCount: (id: string) => number
  onOpen: (id: string) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const [dragOrigin, setDragOrigin] = useState<number | null>(null)
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const activatedRef = useRef(false)
  const grantedRef = useRef(false)
  // 自发提交落位标志：handleDragEnd 持久化成功 → [lists] layout effect 据此走同帧落位路径
  // 而非 cancelDrag 动画回落（三席审查 #5：否则自身重排被误判外部变化，错帧+双卡重叠）
  const committingRef = useRef(false)
  const originRef = useRef(1)
  const hoverRef = useRef(1)
  const dragIdRef = useRef<string | null>(null)
  const listsRef = useRef(lists)
  listsRef.current = lists
  // 默认歌单封面（2026-10-18 拍板纳入封面机制）：pic 走 setting 单键（DEFAULT 不在 userLists），
  // 文件缺失兜底清键回占位+重生成（lovePic 同款降级路径；自动轨文件在缓存目录可能被系统清理）；
  // 旧布局产物（无 v2 标签）静默重生成，写回换新路径后旧文件走常规清理（自建歌单 syncShelfCovers 同款）
  const defaultPic = useSettingValue('list.defaultPic')
  useEffect(() => {
    if (!defaultPic) return
    if (!isCurrentLayoutPic(defaultPic)) {
      queueCoverGen(LIST_IDS.DEFAULT, true)
      return
    }
    let cancelled = false
    void existsFile(defaultPic).then(ok => {
      // stale 守卫（三席审查 I-2）：在途检查期间换图时旧回调放弃，防误清新落库的封面指针
      if (cancelled) return
      if (!ok) {
        setDefaultCover(null, false)
        queueCoverGen(LIST_IDS.DEFAULT, true)
      }
    })
    return () => { cancelled = true }
  }, [defaultPic])
  // 采样主色预热（hero v2 QQ 式）：shelf 渲染封面时按 URI 提取并记忆，点进歌单页取色即时命中，
  // 消首次进入的采样色闪变（真机反馈 2026-10-17）
  useEffect(() => {
    lists.forEach(list => {
      const pic = (list as LX.List.UserListInfo).pic
      if (pic) prefetchAmbientColor(pic)
    })
  }, [lists])
  const dragTx = useRef(new Animated.Value(0)).current
  const itemTxs = useRef<Animated.Value[]>([])
  while (itemTxs.current.length < lists.length) itemTxs.current.push(new Animated.Value(0))
  // 随 lists 收缩裁剪（三席审查 S-C）：只增不减会在歌单删除后残留 Animated.Value
  if (itemTxs.current.length > lists.length) itemTxs.current.length = lists.length

  const resetTxs = () => {
    dragTx.setValue(0)
    itemTxs.current.forEach(tx => tx.setValue(0))
  }
  const clearDrag = () => {
    activatedRef.current = false
    grantedRef.current = false
    hoverRef.current = 1
    dragIdRef.current = null
    setDragOrigin(null)
    setScrollEnabled(true)
  }
  const startDrag = (index: number) => {
    if (activatedRef.current || index === 0) return // 默认歌单固定首位，不参与拖拽
    const list = listsRef.current
    if (!list[index]) return
    activatedRef.current = true
    originRef.current = index
    hoverRef.current = index
    dragIdRef.current = list[index].id
    hapticImpactLight()
    setDragOrigin(index)
    setScrollEnabled(false)
  }
  const animateSwap = (hover: number) => {
    const origin = originRef.current
    const list = listsRef.current
    list.forEach((_item, i) => {
      if (i === origin) return
      let target = 0
      if (origin < hover && i > origin && i <= hover) target = -SHELF_ITEM_STEP
      else if (origin > hover && i >= hover && i < origin) target = SHELF_ITEM_STEP
      Animated.timing(itemTxs.current[i], { toValue: target, duration: 150, useNativeDriver: true }).start()
    })
  }
  const handleDragMove = (dx: number) => {
    const list = listsRef.current
    const maxDx = (list.length - 1 - originRef.current) * SHELF_ITEM_STEP
    const minDx = -(originRef.current - 1) * SHELF_ITEM_STEP
    const clamped = Math.min(Math.max(dx, minDx), maxDx)
    dragTx.setValue(clamped)
    const hover = Math.min(Math.max(originRef.current + Math.round(clamped / SHELF_ITEM_STEP), 1), list.length - 1)
    if (hover !== hoverRef.current) {
      hoverRef.current = hover
      animateSwap(hover)
    }
  }
  const handleDragEnd = async() => {
    const targetHover = hoverRef.current
    const draggedId = dragIdRef.current
    // 视觉对齐落位格；持久化成功后由 [lists] layout effect 在新序首帧前同步清态落位
    Animated.timing(dragTx, { toValue: (targetHover - originRef.current) * SHELF_ITEM_STEP, duration: 100, useNativeDriver: true }).start()
    if (draggedId && targetHover !== originRef.current) {
      // 占格模型：insertPos = 松手展示位 − 1（DEFAULT 偏移），底层为「移除被拖项后」的插入位
      committingRef.current = true
      try {
        await updateUserListPosition(Math.max(targetHover - 1, 0), [draggedId])
        return // 清理收口在 [lists] layout effect（同帧，防错卡浮起一帧/旧序让位偏移继承到新序）
      } catch (err) {
        committingRef.current = false
        // 持久化失败：内存序已变 UI 保持新序，重启后恢复存储序；不阻断清态（防激活态死锁）
        console.log(err)
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100))
    resetTxs()
    clearDrag()
  }
  const cancelDrag = () => {
    Animated.timing(dragTx, { toValue: 0, duration: 150, useNativeDriver: true }).start()
    listsRef.current.forEach((_item, i) => {
      if (i !== originRef.current) Animated.timing(itemTxs.current[i], { toValue: 0, duration: 150, useNativeDriver: true }).start()
    })
    clearDrag()
  }
  // lists 引用变化（新序提交/新建/删除/远端同步重排）：layout effect 在新序首帧绘制前同步收口——
  // 自发提交（committingRef）走同帧清态落位（动画回落会产生错卡浮起/双卡重叠，三席审查 #5）；
  // 外部变化期间拖拽激活 → 立即取消防索引错位拖错歌单，且旧序让位偏移不继承到新序（全部归零）
  useLayoutEffect(() => {
    if (committingRef.current) {
      committingRef.current = false
      resetTxs()
      clearDrag()
      return
    }
    itemTxs.current.forEach(tx => tx.setValue(0))
    if (activatedRef.current) cancelDrag()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists])

  // 存量收藏封面补齐：lists 变化时对缺图在线列表逐个回填（已有 pic/无源条目在 ensureListPic 内短路，无循环风险）。
  // 已知副作用（三席审查 S-I 备案）：回填成功触发 list_update → lists 变化，若拖拽激活中会走外部变化路径取消拖拽（降级回落）
  useEffect(() => {
    lists.forEach(item => {
      if (isCollectList(item)) void ensureListPic(item as LX.List.UserListInfo)
    })
  }, [lists])

  const handlersRef = useRef({ move: (_dx: number) => {}, end: () => {}, cancel: () => {} })
  handlersRef.current = { move: handleDragMove, end: () => { void handleDragEnd() }, cancel: cancelDrag }
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => activatedRef.current,
    onPanResponderGrant: () => { grantedRef.current = true },
    onPanResponderMove: (_e, gs) => {
      if (activatedRef.current) handlersRef.current.move(gs.dx)
    },
    onPanResponderRelease: () => {
      if (activatedRef.current) handlersRef.current.end()
    },
    onPanResponderTerminate: () => {
      if (activatedRef.current) handlersRef.current.cancel()
    },
    onPanResponderTerminationRequest: () => false,
  })).current

  return (
    // 外层纵向滚动（Header 大标题收缩）在拖拽激活期间依赖 TerminationRequest(false) 拒绝让渡；
    // 被原生抢走时走 onPanResponderTerminate 降级回落（单保险，Android 坑区真机验证点）
    <View {...panResponder.panHandlers}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={scrollEnabled} contentContainerStyle={styles.playlistShelfContent}>
        {
          lists.map((item, i) => {
            const dragging = dragOrigin === i
            const collect = isCollectList(item)
            // 默认歌单封面（2026-10-18 拍板纳入）：pic 走 setting 单键，其余列表读条目
            const shelfPic = item.id == LIST_IDS.DEFAULT ? defaultPic : (item as LX.List.UserListInfo).pic
            return (
              <Animated.View
                key={item.id}
                style={[
                  dragging && styles.shelfCardDragging,
                  {
                    // transform 单键整体覆盖（RN 样式数组同键后者胜）：浮起 scale 需并入同一数组（三席审查 #6）
                    transform: [
                      { translateX: i === dragOrigin ? dragTx : itemTxs.current[i] },
                      ...(dragging ? [{ scale: 1.05 }] : []),
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.shelfItemBtn}
                  activeOpacity={0.6}
                  delayLongPress={DRAG_ACTIVATION_MS}
                  onLongPress={() => { startDrag(i) }}
                  // 长按激活后静止松手（外层未抢占、无 move）：零位移落位；被抢占让渡的 onPressOut 不在此收口（由 release 统一处理）
                  onPressOut={() => { if (activatedRef.current && !grantedRef.current) handlersRef.current.end() }}
                  onPress={() => { if (!activatedRef.current) onOpen(item.id) }}
                >
                  <View style={styles.shelfCoverWrap}>
                    {
                      shelfPic
                        ? <Image url={shelfPic ?? null} style={{ ...styles.shelfCoverReal, backgroundColor: theme['c-border-background'] }} resizeMode="cover" />
                        : <PlaylistCover id={item.id} size={84} />
                    }
                    {
                      collect
                        ? <Text style={styles.shelfSrcBadge} size={9} color="#FFFFFF">{t(`source_short_${(item as LX.List.UserListInfo).source}` as keyof Message) || (item as LX.List.UserListInfo).source}</Text>
                        : null
                    }
                  </View>
                  <Text style={styles.playlistShelfName} size={13} color={theme['c-font']} numberOfLines={1}>{item.name}</Text>
                  <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{t('music_count', { count: getCount(item.id) })}</Text>
                </TouchableOpacity>
              </Animated.View>
            )
          })
        }
      </ScrollView>
    </View>
  )
}

const MyMusic = () => {
  const theme = useTheme()
  const t = useI18n()
  const lists = useMyList()
  const dialogRef = useRef<CreateListDialogType>(null)
  // 曲数读 allMusicList 内存 Map，两个事件到达时重渲染刷新
  const [, setMusicVersion] = useState(0)

  useEffect(() => {
    const bump = () => { setMusicVersion(v => v + 1) }
    global.state_event.on('mylistUpdated', bump)
    global.app_event.on('myListMusicUpdate', bump)
    return () => {
      global.state_event.off('mylistUpdated', bump)
      global.app_event.off('myListMusicUpdate', bump)
    }
  }, [])

  // 冷启动预载 shelf 全部歌单（真机反馈 2026-10-18：杀 app 重进曲数全显 0）：allMusicList
  // 惰性加载，不预载则曲数误显 0。预载按组件域拆分：此处只管 shelf 侧——slice(2) 与 shelfLists
  // 同口径（useMyList 的 allList 恒含 LOVE 于 index 1，不得经 map 隐式带回，代码审查 I1），
  // LOVE 归 LoveSection；getListMusics 内存缓存幂等无重复读盘；预载不自发事件，完成后本地
  // bump 刷新；lists 异步就绪后本 effect 重跑，仅缓存未命中才预载+bump（三席审查 S-7）
  useEffect(() => {
    let stale = false
    const ids = [LIST_IDS.DEFAULT, ...lists.slice(2).map(l => l.id)]
    // 仅本次存在缓存未命中（冷启动首载/新增歌单）才预载+bump；全命中说明元数据无变化，
    // store 变更自身已触发重渲染，跳过空转 bump（三席审查 S-7）
    const misses = ids.filter(id => !allMusicList.has(id))
    if (!misses.length) return
    void Promise.all(misses.map(id => getListMusics(id).catch(() => {}))).then(() => {
      if (!stale) setMusicVersion(v => v + 1)
    })
    return () => { stale = true }
  }, [lists])

  const getCount = useCallback((id: string) => allMusicList.get(id)?.length ?? 0, [])

  // shelf = 默认歌单（恒首位）+ userLists 原序混排（自有/收藏不区分，收藏带来源角标）
  const shelfLists = useMemo(() => [lists[0], ...lists.slice(2)], [lists])

  // 自建歌单自动封面补漏（歌单封面机制批①）：pic 三态分流+会话级退避在 gen 模块内，
  // 此处仅随 shelf 内容变化触发检查
  useEffect(() => {
    syncShelfCovers(shelfLists)
  }, [shelfLists])

  return (
    <View style={{ ...styles.section, ...styles.card, backgroundColor: theme['c-content-background'] }}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} size={17} color={theme['c-font']}>{t('tab_my_lists')}</Text>
        <TouchableOpacity style={styles.plusBtn} activeOpacity={0.6} onPress={() => { dialogRef.current?.show() }}>
          <Icon name="plus" size={ICON_SIZE.control} color={theme['c-primary']} />
        </TouchableOpacity>
      </View>
      <CreateListDialog ref={dialogRef} />
      <PlaylistShelf lists={shelfLists} getCount={getCount} onOpen={openList} />
    </View>
  )
}

export default () => {
  return (
    <>
      <QuickNav />
      <LoveSection />
      <RecentPlayCard />
      <MyMusic />
    </>
  )
}

// 原型 v-dense 1:1 dp 值（390 基准）
const styles = StyleSheet.create({
  quick: {
    flexDirection: 'row',
    gap: SPACING.s12,
    paddingHorizontal: SPACING.s16,
    marginBottom: SPACING.s14,
  },
  tile: {
    flex: 1,
    height: 80,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s6,
  },
  tileLabel: {
    fontFamily: FontFamilies.semibold,
  },
  section: {
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  card: {},
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SPACING.s12,
    paddingRight: SPACING.s12,
    paddingTop: SPACING.s14,
    paddingBottom: SPACING.s10,
  },
  cardTitle: {
    fontFamily: FontFamilies.bold,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s2,
  },
  shelfContent: {
    paddingHorizontal: SPACING.s12,
    paddingBottom: SPACING.s16,
    gap: SPACING.s12,
  },
  shelfItem: {
    width: 84,
  },
  shelfCover: {
    width: 84,
    height: 84,
    borderRadius: 10,
    marginBottom: SPACING.s6,
  },
  shelfName: {
    marginBottom: SPACING.s2,
    fontFamily: FontFamilies.semibold,
  },
  // 「我喜欢」hero 卡（2026-10-20 拍板）：红渐变恒铺底层，封面/遮罩叠加层见组件内
  heroCard: {
    height: 128,
    marginHorizontal: SPACING.s16,
    marginBottom: SPACING.s14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.s16,
  },
  heroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s12,
    flexShrink: 1,
  },
  heroTexts: {
    flexShrink: 1,
    gap: SPACING.s2,
  },
  heroName: {
    fontFamily: FontFamilies.bold,
  },
  heroPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtn: {
    // 触区 44（AM-6 拍板），无底色不显形，仅扩大点击区
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -SPACING.s8,
  },
  shelfCardDragging: {
    zIndex: 10,
    elevation: 8,
  },
  playlistShelfContent: {
    paddingHorizontal: SPACING.s12,
    paddingBottom: SPACING.s14,
    gap: SPACING.s12,
  },
  shelfItemBtn: {
    width: 84,
  },
  shelfCoverWrap: {
    position: 'relative',
    marginBottom: SPACING.s6,
  },
  shelfSrcBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  playlistShelfName: {
    marginBottom: SPACING.s2,
    fontFamily: FontFamilies.semibold,
  },
  plCover: {
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 收藏歌单真实封面：与渐变占位同规格（84 方形 r10）
  shelfCoverReal: {
    width: 84,
    height: 84,
    borderRadius: 10,
  },
  plCoverTo: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    opacity: 0.65,
  },
  plCoverIcon: {},
})
