import { useCallback, useMemo, useRef, useState } from 'react'
import { Animated, ScrollView, TouchableOpacity, View } from 'react-native'

import ScreenHeader from '@/components/common/ScreenHeader'
import GlassSurface from '@/components/common/GlassSurface'
import SectionHeader from '@/components/common/SectionHeader'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import PageContent from '@/components/PageContent'
import { PlayerBarPlaceholder } from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { SPACING } from '@/config/spacing'
import { ICON_SIZE } from '@/config/constant'
import { useDislikeRules } from '@/store/dislikeList/hook'
import { state as dislikeState } from '@/store/dislikeList/state'
import { addDislikeInfo, overwirteDislikeInfo } from '@/core/dislikeList'
import { type DislikeRuleItem } from '@/utils/dislikeManage'
import AddRuleSheet, { type AddRuleSheetType } from './AddRuleSheet'

// 播放黑名单管理页（治理批 P5，对标 QQ音乐「黑名单设置」/网易云「音乐黑名单」）：
// 旧「不喜欢的歌曲规则」textarea 手写形态退役，结构化管理（分组条目+删除+表单添加）。
// 存储格式不变（rules 字符串），本页解析渲染（幂等）；添加写入经 utils/dislikeManage 转义单点。
type RuleGroup = DislikeRuleItem['type']

const GROUPS: Array<{ id: RuleGroup, labelKey: 'dislike_group_song_singer' | 'dislike_group_song' | 'dislike_group_singer' }> = [
  { id: 'songSinger', labelKey: 'dislike_group_song_singer' },
  { id: 'song', labelKey: 'dislike_group_song' },
  { id: 'singer', labelKey: 'dislike_group_singer' },
]

const RuleRow = ({ item, onRemove }: { item: DislikeRuleItem, onRemove: (item: DislikeRuleItem) => void }) => {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text numberOfLines={1}>{item.type == 'singer' ? item.singer : item.name}</Text>
        {
          item.type == 'songSinger'
            ? <Text size={12} color={theme['c-font-label']} numberOfLines={1} style={styles.rowSub}>{item.singer}</Text>
            : null
        }
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => { onRemove(item) }}
        accessibilityLabel="remove rule"
      >
        <Icon name="close" size={14} color={theme['c-font-label']} />
      </TouchableOpacity>
    </View>
  )
}

export default ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const theme = useTheme()
  const rules = useDislikeRules()
  const addSheetRef = useRef<AddRuleSheetType>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  // 标准二级页滚动接线（玻璃渐显+标题淡入驱动）
  const scrollY = useRef(new Animated.Value(0)).current
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY])

  const grouped = useMemo(() => {
    const map = new Map<RuleGroup, DislikeRuleItem[]>()
    for (const item of rules) {
      const list = map.get(item.type) ?? []
      list.push(item)
      map.set(item.type, list)
    }
    return map
  }, [rules])

  const showAddSheet = useCallback(() => {
    setSheetVisible(true)
    requestAnimationFrame(() => {
      addSheetRef.current?.show()
    })
  }, [])

  const handleAdd = useCallback((name: string, singer: string) => {
    void addDislikeInfo([{ name, singer }])
    toast(t('dislike_add_success_tip'))
  }, [t])

  // 删除基于 store 最新 rules 过滤（审查 C-1：写操作必须走 core 事件链——持久化+store 回写+
  // dislike_changed 刷新；闭包读最新值防快速连删互相覆盖）
  const handleRemove = useCallback((item: DislikeRuleItem) => {
    const latest = dislikeState.dislikeInfo.rules.split('\n').filter(line => line && line !== item.rule)
    void overwirteDislikeInfo(latest.join('\n'))
  }, [])

  const hasAny = rules.length > 0

  return (
    <PageContent>
      <View style={styles.container}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
        >
          {
            hasAny
              ? GROUPS.map(({ id, labelKey }) => {
                  const items = grouped.get(id) ?? []
                  if (!items.length) return null
                  return (
                    <View key={id}>
                      <SectionHeader label={t(labelKey)} />
                      <GlassSurface style={styles.card} radius={12} hairline="all" fallbackColor={theme['c-content-background']}>
                        {
                          items.map(item => <RuleRow key={item.rule} item={item} onRemove={handleRemove} />)
                        }
                      </GlassSurface>
                    </View>
                  )
                })
              : (
                  <View style={styles.empty}>
                    <Text size={13} color={theme['c-font-label']}>{t('dislike_empty_tip')}</Text>
                  </View>
                )
          }
        </ScrollView>
        <PlayerBarPlaceholder />
      </View>
      <ScreenHeader
        componentId={componentId}
        title={t('dislike_manage_title')}
        progress={scrollY}
        right={
          <TouchableOpacity style={styles.addBtn} onPress={showAddSheet} accessibilityLabel="add rule">
            <Icon name="plus" size={ICON_SIZE.nav} color={theme['c-font']} />
          </TouchableOpacity>
        }
      />
      {
        sheetVisible
          ? <AddRuleSheet ref={addSheetRef} onAdd={handleAdd} />
          : null
      }
    </PageContent>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.s16,
  },
  card: {
    marginBottom: SPACING.s4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s12,
  },
  rowMain: {
    flexGrow: 1,
    flexShrink: 1,
  },
  rowSub: {
    marginTop: 1,
  },
  removeBtn: {
    padding: SPACING.s10,
  },
  empty: {
    paddingTop: 120,
    alignItems: 'center',
  },
  addBtn: {
    paddingHorizontal: SPACING.s12,
    paddingVertical: SPACING.s8,
  },
})
