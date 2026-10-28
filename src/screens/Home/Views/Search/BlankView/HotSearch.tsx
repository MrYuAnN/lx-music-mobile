import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, useState } from 'react'
import { View } from 'react-native'
import { type Source, type InitState } from '@/store/hotSearch/state'
import hotSearchState from '@/store/hotSearch/state'
import SourcesOfflineTip from '@/components/common/SourcesOfflineTip'
import Button from '@/components/common/Button'
import Chip from '@/components/common/Chip'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { SPACING } from '@/config/spacing'

interface ListProps {
  onSearch: (keyword: string) => void
}
export interface HotSearchType {
  show: (source: Source) => void
}


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

// 聚合词块收起态条数（本产品自定阈值，无业界对标数值：与搜索历史 15 条上限对齐、约 3 行词块首屏可容；
// 封顶+展开交互为搜索中间页泛通行做法，方案审查 I-3）
const COLLAPSED_COUNT = 15

// 榜单项（单源模式：序号+按序位梯度着色，前三名主题红；对标网易云/QQ 热搜区，P9）
const RankItem = ({ keyword, index, onSearch }: {
  keyword: string
  index: number
  onSearch: (keyword: string) => void
}) => {
  const theme = useTheme()
  const rankColor = index < 3 ? theme['c-primary'] : theme['c-font-label']
  return (
    <Button style={styles.rankItem} onPress={() => { onSearch(keyword) }}>
      <Text size={13} color={rankColor} style={styles.rankNum}>{index + 1}</Text>
      <Text size={13} color={theme['c-font']} numberOfLines={1} style={styles.rankText}>{keyword}</Text>
    </Button>
  )
}

// 失败/空态占位（P9：不再静默空白）
const EmptyText = () => {
  const theme = useTheme()
  const t = useI18n()
  return <Text style={styles.empty} size={13} color={theme['c-font-label']}>{t('search_hot_search_empty')}</Text>
}

export default forwardRef<HotSearchType, ListProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const [isRank, setIsRank] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // 加载态（审查 S3：防加载期误闪「暂无热搜」空态）+ 请求序号守卫（快速切源竞态，后发先至）
  const [loading, setLoading] = useState(false)
  const requestSeqRef = useRef(0)
  const t = useI18n()
  const theme = useTheme()
  // 边界①（批1 阶段2）：空源集切「全源不可用」提示态
  const [, bumpRender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const listener = () => bumpRender()
    global.state_event.on('sourcesUpdated', listener)
    return () => {
      global.state_event.off('sourcesUpdated', listener)
    }
  }, [])
  const sourcesEmpty = hotSearchState.sources.length == 0

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show(source) {
      // 单源=榜单形态（有原始榜单序），聚合=词块形态（跨源合并无榜单语义）
      setIsRank(source != 'all')
      setExpanded(false)
      const seq = ++requestSeqRef.current
      setLoading(true)
      void getList(source).then((list) => {
        if (isUnmountedRef.current || seq !== requestSeqRef.current) return
        setList(list)
        setLoading(false)
      }).catch(() => {
        // 失败复位（审查 S-4）：不 catch 会永卡 loading 空白
        if (isUnmountedRef.current || seq !== requestSeqRef.current) return
        setList([])
        setLoading(false)
      })
    },
  }), [])

  return (
    <View>
      <Text style={styles.title} size={16}>{t('search_hot_search')}</Text>
      {
        list.length
          ? (
              <View style={styles.list}>
                {
                  isRank
                    ? list.map((keyword, index) => <RankItem key={keyword} keyword={keyword} index={index} onSearch={props.onSearch} />)
                    // 词块（聚合模式：跨源合并无榜单语义，2026-10-22 治理批 P9）
                    : (expanded ? list : list.slice(0, COLLAPSED_COUNT)).map(keyword => <Chip key={keyword} label={keyword} onPress={() => { props.onSearch(keyword) }} />)
                }
              </View>
            )
          : sourcesEmpty
            ? <SourcesOfflineTip />
            : loading
              ? null
              : <EmptyText />
      }
      {
        !isRank && list.length > COLLAPSED_COUNT
          ? (
              <Button style={styles.moreBtn} onPress={() => { setExpanded(value => !value) }}>
                <Text size={13} color={theme['c-font-label']}>{t(expanded ? 'search_hot_search_collapse' : 'search_hot_search_expand')}</Text>
              </Button>
            )
          : null
      }
    </View>
  )
})


const styles = createStyle({
  title: {
    paddingTop: SPACING.s16,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.s4,
  },
  rankItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.s8,
    paddingBottom: SPACING.s8,
    paddingRight: SPACING.s10,
  },
  rankNum: {
    width: 22,
  },
  rankText: {
    flexShrink: 1,
    flex: 1,
  },
  empty: {
    marginTop: SPACING.s10,
  },
  moreBtn: {
    alignSelf: 'center',
    marginTop: SPACING.s10,
    paddingHorizontal: SPACING.s12,
    paddingVertical: SPACING.s6,
  },
})
