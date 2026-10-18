import { useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import OpenListModal, { type ModalType } from './OpenList/Modal'
import SonglistPickerSheet, {
  type SonglistPickerSheetProps,
  type SonglistPickerSheetType,
} from './SonglistPickerSheet'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import songlistState, { type Source, type TagInfo } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

export interface HeaderBarProps {
  source: Source
  tagName: string
  sortId: string
  activeTagId: string
  tagGroups: TagInfo['tags']
  tagsState: SonglistPickerSheetProps['tagsState']
  onSelectTag: SonglistPickerSheetProps['onSelectTag']
  onSelectSort: SonglistPickerSheetProps['onSelectSort']
  onSwitchSource: SonglistPickerSheetProps['onSelectSource']
  onRetryTags: () => void
  /** sheet 打开时该源标签无缓存则补拉（数据链拓扑：getTags 宿主在 Content） */
  onEnsureTags: () => void
}

// 歌单页顶栏（拍板 1/2）：单淡底胶囊「源 · 标签 · 排序 ⌄」恒显三段，全部 12/400 仅颜色分层——
// 源段 c-font-label（source_short_*）/ 标签段 c-primary / 排序段 c-font，分隔点 c-250；
// 触发器规格同排行榜/搜索页定稿（h38/r8/底 c-border-background/内 lineHeight 18）；
// chevron-down 以 chevron-right 旋转 90° 复用（图标集无该字形）。标签/排序超长省略号截断。
// 点胶囊开 SonglistPickerSheet（打开时经 onEnsureTags 补拉标签）；
// 「打开歌单」入口在 sheet 内（拍板：进弹层），以当前生效源打开（打开时取 props.source）。
export default ({
  source,
  tagName,
  sortId,
  activeTagId,
  tagGroups,
  tagsState,
  onSelectTag,
  onSelectSort,
  onSwitchSource,
  onRetryTags,
  onEnsureTags,
}: HeaderBarProps) => {
  const theme = useTheme()
  const t = useI18n()
  const sheetRef = useRef<SonglistPickerSheetType>(null)
  const openListModalRef = useRef<ModalType>(null)

  const sortInfo = songlistState.sortList[source]?.find(s => s.id == sortId)

  const handleOpenSheet = () => {
    sheetRef.current?.show()
    onEnsureTags()
  }

  const handleOpenSonglist = (id: string) => {
    navigations.pushSonglistDetailScreen(commonState.componentIds.home!, {
      play_count: undefined,
      id,
      author: '',
      name: '',
      img: undefined,
      desc: undefined,
      source,
    })
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={{ ...styles.pill, backgroundColor: theme['c-border-background'] }} activeOpacity={0.6} onPress={handleOpenSheet}>
        <Text size={12} style={styles.seg} color={theme['c-font-label']}>{t(`source_short_${source}`)}</Text>
        <Text size={12} style={styles.seg} color={theme['c-250']}>·</Text>
        <Text size={12} style={styles.tagSeg} color={theme['c-primary']} numberOfLines={1}>{tagName || t('songlist_tag_default')}</Text>
        {
          sortInfo
            ? (
                <>
                  <Text size={12} style={styles.seg} color={theme['c-250']}>·</Text>
                  <Text size={12} style={styles.sortSeg} color={theme['c-font']} numberOfLines={1}>{t(`songlist_${sortInfo.tid}`)}</Text>
                </>
              )
            : null
        }
        <Icon name="chevron-right" size={10} color={theme['c-font-label']} style={styles.caret} />
      </TouchableOpacity>
      {/* 打开歌单入口（真机反馈轮拍板：弹层移出 → 顶栏小图标钮，album=歌单 tab 本尊图标） */}
      <TouchableOpacity style={styles.openBtn} activeOpacity={0.6} onPress={() => { openListModalRef.current?.show(source) }}>
        <Icon name="album" size={18} color={theme['c-font-label']} />
      </TouchableOpacity>
      <SonglistPickerSheet
        ref={sheetRef}
        source={source}
        sortId={sortId}
        activeTagId={activeTagId}
        tagGroups={tagGroups}
        tagsState={tagsState}
        onSelectSource={onSwitchSource}
        onSelectTag={onSelectTag}
        onSelectSort={onSelectSort}
        onRetryTags={onRetryTags}
      />
      <OpenListModal ref={openListModalRef} onOpenId={handleOpenSonglist} />
    </View>
  )
}

// 顶栏容器与排行榜触发器同构（px16/pt8/pb8 无底线）——2026-10-16 真机反馈统一规格
const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.s16,
    paddingTop: SPACING.s8,
    paddingBottom: SPACING.s8,
    zIndex: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 38,
    borderRadius: 8,
    paddingHorizontal: SPACING.s10,
    flexShrink: 1,
  },
  seg: {
    lineHeight: 18,
  },
  tagSeg: {
    lineHeight: 18,
    maxWidth: 96,
    flexShrink: 1,
  },
  sortSeg: {
    lineHeight: 18,
    maxWidth: 80,
    flexShrink: 1,
  },
  caret: {
    transform: [{ rotate: '90deg' }],
  },
  openBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
})
