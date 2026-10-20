import { useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useMyList } from '@/store/list/hook'
import { isListContentReadonly } from '@/utils/listManage'
import ListItem, { styles as listStyles } from './ListItem'
import CreateUserList from '../MusicAddModal/CreateUserList'
import { useWindowSize } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { SPACING } from '@/config/spacing'

const styles = createStyle({
  list: {
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s2,
    paddingBottom: SPACING.s6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // backgroundColor: 'rgba(0,0,0,0.2)'
  },
})
const MIN_WIDTH = scaleSizeW(140)
const PADDING = styles.list.paddingLeft + styles.list.paddingRight

const EditListItem = ({ itemWidth }: {
  itemWidth: number
}) => {
  const [isEdit, setEdit] = useState(false)
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={{ ...listStyles.listItem, width: itemWidth }}>
      <TouchableOpacity
        style={{ ...listStyles.button, borderColor: theme['c-primary-light-200-alpha-700'], borderStyle: 'dashed' }}
        onPress={() => { setEdit(true) }}
      >
        <Text style={{ opacity: isEdit ? 0 : 1 }} numberOfLines={1} size={14} color={theme['c-button-font']}>{t('list_create')}</Text>
      </TouchableOpacity>
      {
        isEdit
          ? <CreateUserList isEdit={isEdit} onHide={() => { setEdit(false) }} />
          : null
      }
    </View>
  )
}

export default ({ listId, onPress, readonlySelectable = false, showCreate = true }: {
  listId: string
  onPress: (listInfo: LX.List.MyListInfo) => void
  /** 读语义场景（添加歌曲「其他歌单」来源，方案 playlist-search-add-music §A2/复核 S-a）：
   * 收藏歌单作为读源可选——原排除（isListContentReadonly）是「向其写入」的写防护，读场景不成立；
   * 写场景（移动/添加目标选择）缺省 false 维持现状 */
  readonlySelectable?: boolean
  /** 「+ 新建歌单」入口：添加歌曲页语境无歌可新建，隐藏（复核 S-a） */
  showCreate?: boolean
}) => {
  const windowSize = useWindowSize()
  // 收藏歌单只读（拍板 #2，审查 C2）：目标列表过滤（移动=向 to 写入，双向封堵）；读语义可放宽（readonlySelectable）
  const allList = useMyList().filter(l => l.id != listId && (readonlySelectable || !isListContentReadonly(l.id)))
  const itemWidth = useMemo(() => {
    let w = Math.floor(windowSize.width * 0.9 - PADDING)
    let n = Math.floor(w / MIN_WIDTH)
    if (n > 10) n = 10
    return Math.floor((w - 1) / n)
  }, [windowSize])

  return (
    <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
      <View style={{ ...styles.list }} onStartShouldSetResponder={() => true}>
        { allList.map(info => <ListItem key={info.id} listInfo={info} onPress={onPress} width={itemWidth} />) }
        { showCreate ? <EditListItem itemWidth={itemWidth} /> : null }
      </View>
    </ScrollView>
  )
}
