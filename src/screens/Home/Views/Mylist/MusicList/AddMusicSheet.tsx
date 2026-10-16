import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { FlatList, TextInput, TouchableOpacity, View } from 'react-native'

import Modal, { type ModalType } from '@/components/common/Modal'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Button from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { addListMusics } from '@/core/list'
import musicSdk from '@/utils/musicSdk'
import searchMusicState from '@/store/search/music/state'
import settingState from '@/store/setting/state'
import { createStyle, toast } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

// 添加歌曲到歌单（歌单页重构批②，三钮 ○+ 的自建/内置列表语义）：轻量搜索面板。
// 直连 musicSdk 搜索、本地持有结果（审查 I4：复用全局 search core 会写 searchMusicState
// 污染搜索页关键词/源/结果缓存且共享竞态 key）；默认源取搜索页当前源（偏差记录 §11）
export interface AddMusicSheetType {
  show: (listId: string) => void
}

interface SearchState {
  list: LX.Music.MusicInfoOnline[]
  loading: boolean
  searched: boolean
}

const SEARCH_LIMIT = 30

export default forwardRef<AddMusicSheetType, {}>((_, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const modalRef = useRef<ModalType>(null)
  const listIdRef = useRef<string>('')
  const [keyword, setKeyword] = useState('')
  const [state, setState] = useState<SearchState>({ list: [], loading: false, searched: false })

  useImperativeHandle(ref, () => ({
    show(listId) {
      listIdRef.current = listId
      setKeyword('')
      setState({ list: [], loading: false, searched: false })
      modalRef.current?.setVisible(true)
    },
  }))

  const handleSearch = () => {
    const text = keyword.trim()
    // 聚合源 'all' 非音乐源，回退 kw（审查 I4 直连改造附带修正）
    const source = searchMusicState.source == 'all' ? 'kw' : searchMusicState.source
    if (!text || !listIdRef.current) return
    setState(prev => ({ ...prev, loading: true }))
    void (musicSdk[source]?.musicSearch.search(text, 1, SEARCH_LIMIT) as Promise<{ list: LX.Music.MusicInfoOnline[] }> ?? Promise.reject(new Error('source not found: ' + source)))
      .then(result => {
        setState({ list: result.list ?? [], loading: false, searched: true })
      })
      .catch(() => {
        setState(prev => ({ ...prev, loading: false, searched: true }))
        toast(t('list_error'))
      })
  }

  const handleAdd = (musicInfo: LX.Music.MusicInfoOnline) => {
    void addListMusics(listIdRef.current, [musicInfo], settingState.setting['list.addMusicLocationType']).then(() => {
      toast(t('list_edit_action_tip_add_success'))
    }).catch(() => {
      toast(t('list_edit_action_tip_add_failed'))
    })
  }

  return (
    <Modal ref={modalRef} bgColor="rgba(0,0,0,0.35)">
      <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
        <View style={{ ...styles.searchRow, backgroundColor: theme['c-input-background'] }}>
          <TextInput
            style={{ ...styles.input, color: theme['c-font'] }}
            value={keyword}
            placeholder={t('search_placeholder')}
            placeholderTextColor={theme['c-font-label']}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <Button style={styles.searchBtn} onPress={handleSearch}>
            <Icon color={theme['c-font']} name="search-2" size={18} />
          </Button>
        </View>
        {
          state.loading
            ? <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('list_loading')}</Text>
            : state.searched && !state.list.length
              ? <Text style={styles.tip} size={13} color={theme['c-font-label']}>{t('no_item')}</Text>
              : null
        }
        <FlatList
          style={styles.list}
          data={state.list}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text size={14} color={theme['c-font']} numberOfLines={1}>{item.name}</Text>
                <Text size={12} color={theme['c-font-label']} numberOfLines={1}>{item.singer}</Text>
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={() => { handleAdd(item) }} activeOpacity={0.6}>
                <Icon color={theme['c-primary']} name="plus" size={20} />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </Modal>
  )
})

const styles = createStyle({
  container: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    maxHeight: '72%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingTop: SPACING.s12,
    paddingHorizontal: SPACING.s16,
    paddingBottom: SPACING.s16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: SPACING.s10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  searchBtn: {
    paddingHorizontal: SPACING.s6,
  },
  tip: {
    textAlign: 'center',
    paddingTop: SPACING.s16,
  },
  list: {
    marginTop: SPACING.s8,
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  addBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
