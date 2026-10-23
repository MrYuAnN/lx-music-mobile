import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { type InitState } from '@/store/hotSearch/state'
import Chip from '@/components/common/Chip'
import Text from '@/components/common/Text'
import { createStyle, confirmDialog } from '@/utils/tools'
import { ICON_SIZE } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import { Icon } from '@/components/common/Icon'
import { SPACING } from '@/config/spacing'

export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>


interface HistorySearchProps {
  onSearch: (keyword: string) => void
}
export interface HistorySearchType {
  show: () => void
}

export default forwardRef<HistorySearchType, HistorySearchProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const isUnmountedRef = useRef(false)
  const t = useI18n()
  const theme = useTheme()

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show() {
      void getSearchHistory().then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      })
    },
  }), [])

  // 清空加二次确认（P9：误触即丢全部历史）
  const handleClear = useCallback(() => {
    void confirmDialog({
      message: t('search_history_clear_confirm'),
      confirmButtonText: t('confirm'),
    }).then(isConfirm => {
      if (!isConfirm) return
      clearHistoryList()
      setList([])
    })
  }, [t])

  // 审查 I2：副作用移出 setState updater（纯函数契约）+ indexOf 未命中守卫（防 -1 误删末条）
  const handleRemove = useCallback((keyword: string) => {
    const index = list.indexOf(keyword)
    if (index < 0) return
    const next = [...list]
    next.splice(index, 1)
    setList(next)
    removeHistoryWord(index)
  }, [list])

  return (
    list.length
      ? (
          <View>
            <View style={styles.titleContent}>
              <Text size={16}>{t('search_history_search')}</Text>
              <TouchableOpacity onPress={handleClear} style={styles.titleBtn} accessibilityLabel={t('search_history_clear')}>
                <Icon name="eraser" color={theme['c-300']} size={ICON_SIZE.inline} />
              </TouchableOpacity>
            </View>
            <View style={styles.list}>
              {
                list.map(keyword => (
                  <Chip
                    key={keyword}
                    label={keyword}
                    onPress={() => { props.onSearch(keyword) }}
                    onRemove={() => { handleRemove(keyword) }}
                    removeAccessibilityLabel={t('search_history_delete')}
                    style={styles.historyChip}
                  />
                ))
              }
            </View>
          </View>
        )
      : null
  )
})


const styles = createStyle({
  titleContent: {
    paddingTop: SPACING.s16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBtn: {
    marginLeft: SPACING.s10,
    padding: SPACING.s6,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.s4,
  },
  historyChip: {
    maxWidth: 170,
  },
})
