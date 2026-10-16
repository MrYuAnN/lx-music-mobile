import { useRef, forwardRef, useImperativeHandle, useState, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import SearchBar, { type SearchBarType } from '@/components/common/SearchBar'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { SPACING } from '@/config/spacing'
import { type Source as MusicSource } from '@/store/search/music/state'
import { type Source as SonglistSource } from '@/store/search/songlist/state'

type Sources = Readonly<Array<MusicSource | SonglistSource>>

export interface HeaderBarProps {
  onSourceChange: (source: Sources[number]) => void
  onTipSearch: (text: string) => void
  onSearch: (text: string) => void
  onHideTipList: () => void
  onShowTipList: () => void
}

export interface HeaderBarType {
  setSourceList: (list: Sources, source: Sources[number]) => void
  setText: (text: string) => void
  blur: () => void
}

// 搜索页顶栏（问题 2）：全局 SearchBar 单框，来源前缀（来源名+▾，DorpDownMenu 锚定弹出）
// 替换原「SourceSelector 独立列 + Input」两列结构
export default forwardRef<HeaderBarType, HeaderBarProps>(({ onSourceChange, onTipSearch, onSearch, onHideTipList, onShowTipList }, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const searchBarRef = useRef<SearchBarType>(null)
  const [sourceList, setSourceList] = useState<Sources>([] as unknown as Sources)
  const [source, setSource] = useState<Sources[number]>('kw')

  useImperativeHandle(ref, () => ({
    setSourceList(list, activeSource) {
      setSourceList(list)
      setSource(activeSource)
    },
    setText(text) {
      searchBarRef.current?.setText(text)
    },
    blur() {
      searchBarRef.current?.blur()
    },
  }), [])

  const menus = useMemo(() => {
    return sourceList.map(s => ({ label: t(`source_real_${s}`), action: s }))
  }, [sourceList, t])

  const handleChangeSource = ({ action }: { action: string }) => {
    onSourceChange(action as Sources[number])
    setSource(action as Sources[number])
  }

  const prefix = sourceList.length
    ? (
        // 窄触发器（来源名+▾）钉死菜单宽会截断「酷狗音乐」等长源名，菜单宽自适应内容
        <DorpDownMenu menus={menus} onPress={handleChangeSource} activeId={source} btnStyle={styles.sourceBtn} fitMenuWidth>
          <View style={styles.sourcePrefix}>
            <Text size={13} color={theme['c-font']} numberOfLines={1}>{t(`source_real_${source}`)}</Text>
            <Text size={8} style={styles.caret} color={theme['c-font-label']}>▼</Text>
          </View>
        </DorpDownMenu>
      )
    : null

  return (
    <View style={styles.container}>
      <SearchBar
        ref={searchBarRef}
        placeholder={t('search_placeholder')}
        onChangeText={onTipSearch}
        onSubmit={onSearch}
        onClear={() => { onSearch('') }}
        onBlur={onHideTipList}
        onTouchStart={onShowTipList}
        prefix={prefix}
        tone="plain"
        style={styles.searchBar}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.s16,
    paddingTop: SPACING.s8,
    zIndex: 2,
  },
  searchBar: {
    paddingHorizontal: SPACING.s10,
  },
  sourceBtn: {
    paddingVertical: SPACING.s4,
  },
  sourcePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s4,
    height: '100%',
  },
  caret: {
    transform: [{ scaleY: 0.9 }],
  },
})
