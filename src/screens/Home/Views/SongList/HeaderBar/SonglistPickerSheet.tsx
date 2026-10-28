import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import SheetBase, { type SheetBaseType } from '@/components/common/SheetBase'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import songlistState, { type Source, type TagInfo } from '@/store/songlist/state'
import { SPACING } from '@/config/spacing'

export interface SonglistPickerSheetType {
  show: () => void
  hide: () => void
}

export interface SonglistPickerSheetProps {
  source: Source
  sortId: string
  activeTagId: string
  tagGroups: TagInfo['tags']
  tagsState: 'loading' | 'error' | 'ready'
  onSelectSource: (source: Source) => void
  onSelectTag: (name: string, id: string) => void
  onSelectSort: (id: string) => void
  onRetryTags: () => void
}

// 歌单筛选级联 sheet（拍板 5/6 + 2026-10-18 真机反馈轮重构）：
// 「音源」标题 + 音源 chips 横滑行固定（排行榜 BoardPickerSheet 同构，切源随时可达）；
// 滚动区 =「排序」组（跟随滑动）+「标签」组（默认 chip 首位 + 全量分组；热门组已删——
// 页面顶栏热门行已展示 hotTag，弹层不再重复）。
// 点选即时应用 + 停留，无完成钮（遮罩/返回键/下拉把手关闭——真机反馈轮拍板）。
// 数据全部经 props 自 Content 单链（getTags 宿主在 Content，本组件零拉取——数据链拓扑节）。
export default forwardRef<SonglistPickerSheetType, SonglistPickerSheetProps>(({
  source,
  sortId,
  activeTagId,
  tagGroups,
  tagsState,
  onSelectSource,
  onSelectTag,
  onSelectSort,
  onRetryTags,
}, ref) => {
  const theme = useTheme()
  // 摘源联动（批1 阶段2）：源 chips 直接渲染 store state，订阅广播触发重渲染取最新集
  const [, bumpRender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const handleSourcesUpdated = () => bumpRender()
    global.state_event.on('sourcesUpdated', handleSourcesUpdated)
    return () => {
      global.state_event.off('sourcesUpdated', handleSourcesUpdated)
    }
  }, [])
  const t = useI18n()
  const sheetRef = useRef<SheetBaseType>(null)

  useImperativeHandle(ref, () => ({
    show() {
      sheetRef.current?.setVisible(true)
    },
    hide() {
      sheetRef.current?.setVisible(false)
    },
  }), [])

  const sorts = songlistState.sortList[source] ?? []

  return (
    <SheetBase ref={sheetRef} title={t('songlist_filter_title')} maxHeight="72%">
      {/* 音源区（固定）：标题 + 横滑行，排行榜弹层同构（固定区标题自带水平 padding） */}
      <Text style={styles.zoneLabelFixed} size={12} color={theme['c-font-label']}>{t('filter_source')}</Text>
      <ScrollView horizontal style={styles.srcRow} contentContainerStyle={styles.srcRowContent} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
        {
          songlistState.sources.map(s => {
            const active = s == source
            return (
              <TouchableOpacity
                key={s}
                style={{ ...styles.srcChip, backgroundColor: active ? theme['c-primary-alpha-900'] : theme['c-border-background'] }}
                activeOpacity={0.6}
                onPress={() => { onSelectSource(s) }}
              >
                <Text size={13} numberOfLines={1} color={active ? theme['c-primary'] : theme['c-font-label']}>{t(`source_real_${s}`)}</Text>
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>
      {/* 滚动区：排序（本地数据恒渲染，不随标签加载态消失——二轮审查 I-1 分层口径）+ 标签（loading/error/ready 三态） */}
      <ScrollView style={styles.tagScroll} contentContainerStyle={styles.tagContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
        <Text style={styles.zoneLabel} size={12} color={theme['c-font-label']}>{t('filter_sort')}</Text>
        <View style={styles.tagWrap}>
          {
            sorts.map(s => {
              const active = s.id == sortId
              return (
                <TouchableOpacity
                  key={s.id}
                  style={{ ...styles.chip, backgroundColor: active ? theme['c-primary-alpha-900'] : theme['c-border-background'] }}
                  activeOpacity={0.6}
                  onPress={() => { onSelectSort(s.id) }}
                >
                  <Text size={13} numberOfLines={1} color={active ? theme['c-primary'] : theme['c-font']}>{t(`songlist_${s.tid}`)}</Text>
                </TouchableOpacity>
              )
            })
          }
        </View>
        <Text style={styles.zoneLabel} size={12} color={theme['c-font-label']}>{t('filter_tag')}</Text>
        {
          tagsState == 'loading'
            ? <Text style={styles.stateText} size={13} color={theme['c-font-label']}>{t('list_loading')}</Text>
            : tagsState == 'error'
              ? (
                  <View style={styles.stateWrap}>
                    <Text size={13} color={theme['c-font-label']}>{t('load_failed_tip')}</Text>
                    <TouchableOpacity style={{ ...styles.retryBtn, borderColor: theme['c-primary'] }} activeOpacity={0.6} onPress={onRetryTags}>
                      <Text size={13} color={theme['c-primary']}>{t('songlist_tag_retry')}</Text>
                    </TouchableOpacity>
                  </View>
                )
              : (
                <>
                  <View style={styles.tagWrap}>
                    {
                      [{ id: '', name: t('songlist_tag_default'), parent_id: '', parent_name: '', source }].map(item => {
                        const active = item.id == activeTagId
                        return (
                          <TouchableOpacity
                            key={item.id || '__default__'}
                            style={{ ...styles.chip, backgroundColor: active ? theme['c-primary-alpha-900'] : theme['c-border-background'] }}
                            activeOpacity={0.6}
                            onPress={() => { onSelectTag(item.name, item.id) }}
                          >
                            <Text size={13} numberOfLines={1} color={active ? theme['c-primary'] : theme['c-font']}>{item.name}</Text>
                          </TouchableOpacity>
                        )
                      })
                    }
                  </View>
                  {
                    tagGroups.map((group, index) => (
                      <View key={index}>
                        {
                          group.name
                            ? <Text style={styles.groupLabel} size={12} color={theme['c-font-label']}>{group.name}</Text>
                            : null
                        }
                        <View style={styles.tagWrap}>
                          {
                            group.list.map(item => {
                              const active = item.id == activeTagId
                              return (
                                <TouchableOpacity
                                  key={item.id}
                                  style={{ ...styles.chip, backgroundColor: active ? theme['c-primary-alpha-900'] : theme['c-border-background'] }}
                                  activeOpacity={0.6}
                                  onPress={() => { onSelectTag(item.name, item.id) }}
                                >
                                  <Text size={13} numberOfLines={1} color={active ? theme['c-primary'] : theme['c-font']}>{item.name}</Text>
                                </TouchableOpacity>
                              )
                            })
                          }
                        </View>
                      </View>
                    ))
                  }
                </>
              )
        }
      </ScrollView>
    </SheetBase>
  )
})

const styles = createStyle({
  // 固定区 zone 标题（音源行上方，自带水平 padding 与行内 chips 对齐）
  zoneLabelFixed: {
    marginTop: SPACING.s10,
    marginBottom: SPACING.s8,
    paddingHorizontal: SPACING.s20,
  },
  // 滚动区 zone 标题（排序/标签）：无水平 padding——tagContent 已有 20，双重会错位（真机反馈轮 2 轮对齐修复）
  zoneLabel: {
    marginTop: SPACING.s12,
    marginBottom: SPACING.s8,
  },
  srcRow: {
    flexGrow: 0,
    flexShrink: 0,
  },
  srcRowContent: {
    paddingHorizontal: SPACING.s20,
    paddingBottom: SPACING.s10,
    gap: SPACING.s8,
    alignItems: 'center',
  },
  // 音源行与排行榜 BoardPickerSheet srcChip 同构（h26）
  srcChip: {
    height: 26,
    borderRadius: 999,
    paddingHorizontal: SPACING.s12,
    justifyContent: 'center',
  },
  tagScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  tagContent: {
    paddingHorizontal: SPACING.s20,
    paddingBottom: SPACING.s20,
  },
  // 子组名（语种/风格等）与 zone 标题平级平铺、不缩进（业界式——真机反馈轮 3 轮拍板，缩进不直观已撤）
  groupLabel: {
    marginTop: SPACING.s12,
    marginBottom: SPACING.s8,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s8,
  },
  chip: {
    height: 28,
    borderRadius: 999,
    paddingHorizontal: SPACING.s12,
    justifyContent: 'center',
    maxWidth: 150,
  },
  stateText: {
    textAlign: 'center',
    paddingTop: SPACING.s24,
  },
  stateWrap: {
    alignItems: 'center',
    paddingTop: SPACING.s24,
  },
  retryBtn: {
    marginTop: SPACING.s12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: SPACING.s16,
    height: 30,
    justifyContent: 'center',
  },
})
