import { memo, useState, type RefObject } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import DotsVertical from '@/components/common/DotsVertical'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import Loading from '@/components/common/Loading'
import LinearGradient from 'react-native-linear-gradient'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 歌单页共享头部（歌单页重构批②，两页同构，对榜样 AM Android 实拍）：
// 顶栏（← /搜索/⋮）+ 居中大封面（缺失→品牌渐变占位）+ 名称区（歌单名+副行+同步 loading）+
// 三钮行（随机○ / 播放胶囊 / 语义钮○+）+ 简介（在线页，2 行折叠展开）。
// 文字/图标走主题 token，明暗对比由 PageContent 氛围层纱罩保证（播放页同款机制）；
// 头部长按=回顶（审查 A10，顶条长按回顶的承接位）。
const COVER_SIZE = 132

export interface PlaylistHeaderProps {
  title: string
  subtitle?: string
  pic?: string
  desc?: string
  fetching?: boolean
  collected?: boolean
  thirdAction: 'collect' | 'clone' | 'addMusic'
  showBack?: boolean
  showSearch?: boolean
  showManage?: boolean
  onBack?: () => void
  onSearch?: () => void
  onManageMenu?: () => void
  onPlay: () => void
  onShuffle: () => void
  onThird: () => void
  onScrollToTop?: () => void
  // coverFly 透传（在线页封面飞入目标，批②c）
  coverContainerRef?: RefObject<View | null>
  coverOnLayout?: (e: { nativeEvent: { layout: { x: number, y: number, width: number, height: number } } }) => void
  coverNativeID?: string
  coverSettled?: boolean
  coverImageStyle?: object | null
}

const PLACEHOLDER_COLORS = ['#FA233B', '#8a1e6e']

export default memo(({
  title, subtitle, pic, desc, fetching, collected, thirdAction,
  showBack, showSearch, showManage,
  onBack, onSearch, onManageMenu, onPlay, onShuffle, onThird, onScrollToTop,
  coverContainerRef, coverOnLayout, coverNativeID, coverSettled, coverImageStyle,
}: PlaylistHeaderProps) => {
  const theme = useTheme()
  const t = useI18n()
  const statusbarHeight = useStatusbarHeight()
  const [descExpanded, setDescExpanded] = useState(false)

  const thirdIcon = collected ? 'love-fill' : 'plus'
  const thirdColor = collected ? theme['c-primary'] : theme['c-font']

  return (
    <View style={{ ...styles.container, paddingTop: statusbarHeight }} pointerEvents="box-none">
      <View style={styles.topbar}>
        {
          showBack
            ? (
                <TouchableOpacity style={styles.topBtn} onPress={onBack} activeOpacity={0.6}>
                  <Icon color={theme['c-font']} name="chevron-left" size={22} />
                </TouchableOpacity>
              )
            : null
        }
        <View style={styles.topbarSpacer} />
        {
          showSearch
            ? (
                <TouchableOpacity style={styles.topBtn} onPress={onSearch} activeOpacity={0.6}>
                  <Icon color={theme['c-font']} name="search-2" size={20} />
                </TouchableOpacity>
              )
            : null
        }
        {
          showManage
            ? (
                <TouchableOpacity style={styles.topBtn} onPress={onManageMenu} activeOpacity={0.6}>
                  {/* 三点恒竖向（项目级 UI 约定）：Icon 的 dots-vertical glyph 实为横向三点，不可用 */}
                  <DotsVertical color={theme['c-font']} />
                </TouchableOpacity>
              )
            : null
        }
      </View>
      <TouchableOpacity
        style={styles.body}
        activeOpacity={1}
        onLongPress={onScrollToTop}
        // 头部长按=回顶（审查 A10）；封面 pointerEvents none 让长按落到本层
      >
        <View
          ref={coverContainerRef}
          onLayout={coverOnLayout}
          style={{ ...styles.cover, backgroundColor: theme['c-border-background'] }}
          pointerEvents="none"
        >
          {
            pic && coverSettled !== false
              ? (
                  <Image
                    url={pic}
                    nativeID={coverNativeID}
                    style={{ ...styles.coverImage, ...(coverImageStyle ?? {}) }}
                    resizeMode="cover"
                  />
                )
              : (
                  <LinearGradient colors={PLACEHOLDER_COLORS} style={styles.coverPlaceholder}>
                    <Icon color="rgba(255,255,255,.85)" name="music" size={44} />
                  </LinearGradient>
                )
          }
        </View>
        <Text style={styles.title} size={21} color={theme['c-font']} numberOfLines={1}>{title}</Text>
        <View style={styles.subtitleRow}>
          { fetching ? <Loading color={theme['c-font-label']} style={styles.fetching} /> : null }
          {
            subtitle
              ? <Text size={13} color={theme['c-font-label']} numberOfLines={1}>{subtitle}</Text>
              : null
          }
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={{ ...styles.circleBtn, backgroundColor: theme['c-border-background'] }} onPress={onShuffle} activeOpacity={0.7}>
            <Icon color={theme['c-font']} name="list-random" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={{ ...styles.playBtn, backgroundColor: theme['c-font'] }} onPress={onPlay} activeOpacity={0.8}>
            <Icon color={theme['c-content-background']} name="play" size={18} />
            <Text size={16} color={theme['c-content-background']}>{t('play')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ ...styles.circleBtn, backgroundColor: theme['c-border-background'] }} onPress={onThird} activeOpacity={0.7}>
            <Icon color={thirdColor} name={thirdIcon} size={20} />
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
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 0,
  },
  topbar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.s6,
  },
  topbarSpacer: {
    flex: 1,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s8,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: SPACING.s14,
    fontWeight: '600',
  },
  subtitleRow: {
    marginTop: SPACING.s4,
    height: 20,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fetching: {
    marginRight: SPACING.s4,
    transform: [{ scale: 0.6 }],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s12,
    gap: SPACING.s16,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    height: 48,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: SPACING.s20,
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
})
