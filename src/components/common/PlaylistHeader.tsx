import { memo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import LinearGradient from 'react-native-linear-gradient'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 歌单页共享头部（两页同构；QQ 式全页融合改版 2026-10-17 拍板 D1）：
// 头部区=透明占位（透出下层全页氛围画布，模糊封面与整页同层→分界线构造性消失），
// 无封面歌单渲染品牌渐变+音符装饰层（I-D，浮于纯色底，非封面）；
// 名称区（标题+副行[♥ 紧跟副文居中组，仅在线页，真机反馈轮 4 拍板]）+ 双胶囊行（播放[本列表两态，AM 语义]/随机播放）+ 简介。
// 顶栏已移出滚动流为固定悬浮组件（PlaylistTopBar，滚动渐显 D2）。
// 明暗文字对比由 PageContent 氛围层纱罩保证；头部长按=回顶（审查 A10）。
// 对标边界（v1 批 I-E 披露延续）：AM 26.4 全幅仅限官方内容，QQ 式全页融合对标用户实拍
const HERO_HEIGHT_MAX = 380
const HEART_COLOR = '#FA233B'
const HEART_COLOR_DARK = '#FB4B54'

// 头部占位区高度（hero v2 QQ 式：上半=封面背景图，与 PageContent 采样色铺底的上图高度必须一致对齐）
export const getPlaylistHeroHeight = (windowHeight: number) => Math.min(HERO_HEIGHT_MAX, windowHeight * 0.5)

export interface PlaylistHeaderProps {
  title: string
  subtitle?: string
  desc?: string
  fetching?: boolean
  /** 歌单封面：仅用于无封面时的占位判定（氛围层在页面级独立供源，此处不渲染封面） */
  pic?: string
  /** 在线页收藏态（♥ 实心/空心入参） */
  collected?: boolean
  /** 副行右侧 ♥ toggle 开关（仅在线歌单详情页传） */
  showCollectHeart?: boolean
  onCollectToggle?: () => void
  /** 本列表播放中（调用方判定：本地页比对 playerListId，在线页比对 TEMP 队列 id） */
  playing?: boolean
  onTogglePlay?: () => void
  onPlay: () => void
  /** 真乱序随机播放：调用方切 random 模式 + 从第一首开始（D3 拍板） */
  onShufflePlay: () => void
  onScrollToTop?: () => void
}

const PLACEHOLDER_COLORS = ['#FA233B', '#8a1e6e']

export default memo(({
  title, subtitle, desc, fetching, pic, collected, showCollectHeart, onCollectToggle,
  playing, onTogglePlay,
  onPlay, onShufflePlay, onScrollToTop,
}: PlaylistHeaderProps) => {
  const theme = useTheme()
  const t = useI18n()
  const windowSize = useWindowSize()
  const [descExpanded, setDescExpanded] = useState(false)

  const heroHeight = getPlaylistHeroHeight(windowSize.height)
  const isPrimaryPlaying = !!playing && !!onTogglePlay
  const heartColor = theme.isDark ? HEART_COLOR_DARK : HEART_COLOR

  const pressPrimary = () => {
    if (isPrimaryPlaying) onTogglePlay?.()
    else onPlay()
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity style={{ ...styles.hero, height: heroHeight }} activeOpacity={1} onLongPress={onScrollToTop}>
        {
          // 无封面歌单：品牌渐变+音符装饰层（I-D，浮于纯色底），有封面时透出氛围画布不遮挡
          !pic
            ? (
                <LinearGradient colors={PLACEHOLDER_COLORS} style={styles.placeholder}>
                  <Icon color="rgba(255,255,255,.85)" name="music" size={44} />
                </LinearGradient>
              )
            : null
        }
      </TouchableOpacity>
      <View style={styles.body} pointerEvents="box-none">
        <Text style={styles.title} size={21} color={theme['c-font']} numberOfLines={1}>{title}</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.subtitleContent}>
            { fetching ? <Loading color={theme['c-font-label']} style={styles.fetching} /> : null }
            {
              subtitle
                ? <Text size={13} color={theme['c-font-label']} numberOfLines={1}>{subtitle}</Text>
                : null
            }
            {
              showCollectHeart
                ? (
                    <TouchableOpacity style={styles.heartBtn} onPress={onCollectToggle} activeOpacity={0.6}>
                      <Icon name={collected ? 'love-fill' : 'love'} size={22} color={collected ? heartColor : theme['c-font-label']} />
                    </TouchableOpacity>
                  )
                : null
            }
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={{ ...styles.pillPrimary, backgroundColor: theme['c-font'] }}
            onPress={pressPrimary}
            activeOpacity={0.8}
          >
            <Icon color={theme['c-content-background']} name={isPrimaryPlaying ? 'pause' : 'play'} size={18} />
            <Text size={16} color={theme['c-content-background']}>{t(isPrimaryPlaying ? 'pause' : 'play')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ ...styles.pillSecondary, backgroundColor: theme['c-border-background'] }}
            onPress={onShufflePlay}
            activeOpacity={0.7}
          >
            <Icon color={theme['c-font']} name="list-random" size={17} />
            <Text size={15} color={theme['c-font']}>{t('play_list_random')}</Text>
          </TouchableOpacity>
        </View>
        {
          desc
            ? (
                <View style={styles.descWrap}>
                  <Text size={14} color={theme['c-font']} numberOfLines={descExpanded ? undefined : 2}>{desc}</Text>
                  <Text style={styles.descToggle} size={14} color={theme['c-font-label']} onPress={() => { setDescExpanded(v => !v) }}>
                    {descExpanded ? t('list_desc_collapse') : t('list_desc_expand')}
                  </Text>
                </View>
              )
            : null
        }
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 0,
  },
  hero: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s8,
  },
  title: {
    marginTop: SPACING.s14,
    fontWeight: '600',
  },
  subtitleRow: {
    alignSelf: 'stretch',
    marginTop: SPACING.s4,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '78%',
  },
  // ♥ 紧跟副文（居中组内流式排布，真机反馈轮 4：原 absolute 右缘钉死离居中内容过远显偏）
  heartBtn: {
    marginLeft: SPACING.s6,
    paddingHorizontal: SPACING.s8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s12,
    gap: SPACING.s12,
  },
  pillPrimary: {
    flex: 1.15,
    height: 48,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s6,
  },
  pillSecondary: {
    flex: 1,
    height: 48,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s6,
  },
  descWrap: {
    alignSelf: 'stretch',
    marginTop: SPACING.s10,
  },
  descToggle: {
    marginTop: SPACING.s2,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  fetching: {
    marginRight: SPACING.s4,
    transform: [{ scale: 0.6 }],
  },
})
