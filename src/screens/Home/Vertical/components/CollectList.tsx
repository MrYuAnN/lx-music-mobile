import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

const TILE_SIZE = scaleSizeW(44)
const ITEM_HEIGHT = scaleSizeH(64)

// 收藏的在线歌单（批次⑤）：userList 中带 sourceListId 且非榜单（board__ 前缀）的条目
const CollectItem = memo(({ item, onPress }: {
  item: LX.List.UserListInfo
  onPress: (item: LX.List.UserListInfo) => void
}) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <TouchableOpacity style={{ ...styles.listItem, height: ITEM_HEIGHT }} onPress={() => { onPress(item) }}>
      {
        item.meta?.img
          ? <Image
              url={item.meta.img}
              nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.sourceListId}`}
              style={{ ...styles.tile, borderRadius: 10 }}
            />
          : <View style={{ ...styles.tile, backgroundColor: theme['c-primary-light-400-alpha-900'] }}>
              <Icon name="album" size={18} color={theme['c-primary']} />
            </View>
      }
      <View style={styles.listInfo}>
        <Text numberOfLines={1} size={16} color={theme['c-font']}>{item.name}</Text>
        <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{item.meta?.author ?? t('collect_songlist')}</Text>
      </View>
      <Icon name="chevron-right-2" size={14} color={theme['c-font-label']} />
    </TouchableOpacity>
  )
})

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const allList = useMyList()
  const collectLists = allList.filter((l): l is LX.List.UserListInfo => (
    'sourceListId' in l && !!l.sourceListId && !!l.source && !l.sourceListId.startsWith('board__')
  ))
  // 存量兜底：旧版查重失效期间可能产生的重复收藏按 source+sourceListId 去重展示
  const seen = new Set<string>()
  const uniqueLists = collectLists.filter(l => {
    const key = `${l.source}__${l.sourceListId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const handlePress = (item: LX.List.UserListInfo) => {
    const componentId = commonState.componentIds.home
    if (!componentId || !item.sourceListId || !item.source) return
    navigations.pushSonglistDetailScreen(componentId, {
      id: item.sourceListId,
      name: item.name,
      author: item.meta?.author ?? '',
      img: item.meta?.img,
      desc: item.meta?.desc,
      play_count: item.meta?.play_count,
      total: item.meta?.total,
      source: item.source,
    })
  }

  if (!uniqueLists.length) {
    return (
      <View style={styles.empty}>
        <Text size={13} color={theme['c-font-label']}>{t('collect_list_empty')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {
        uniqueLists.map(item => (
          <CollectItem key={item.id} item={item} onPress={handlePress} />
        ))
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flexGrow: 0,
    flexShrink: 1,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: {
    flex: 1,
    flexShrink: 1,
    paddingLeft: 12,
    paddingRight: 8,
    justifyContent: 'center',
    gap: 2,
  },
})
