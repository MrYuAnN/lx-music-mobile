import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text, { FontFamilies } from './Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

// 实心筛选胶囊 chips（Spotify/YT Music 口径，问题 2/3 拍板）：选中主色实底反白，
// 未选中 c-input-background 底；高 31 r999 字13，间距 10 左对齐 16；count 为 label 后缀计数
export interface CategoryChipItem {
  id: string
  label: string
  count?: number
}

export default memo(({ items, activeId, onChange, style }: {
  items: CategoryChipItem[]
  activeId: string
  onChange: (id: string) => void
  style?: object
}) => {
  const theme = useTheme()

  return (
    <View style={{ ...styles.container, ...style }}>
      {
        items.map(item => {
          const isActive = item.id == activeId
          return (
            <TouchableOpacity
              key={item.id}
              style={{
                ...styles.chip,
                backgroundColor: isActive ? theme['c-primary'] : theme['c-input-background'],
              }}
              activeOpacity={0.7}
              onPress={() => { if (!isActive) onChange(item.id) }}
            >
              <Text
                size={13}
                color={isActive ? theme['c-on-primary'] : theme['c-font']}
                style={isActive ? styles.labelActive : null}
              >{item.label}</Text>
              {
                item.count != null
                  ? (
                      <Text
                        size={13}
                        style={{ ...styles.count, opacity: isActive ? 0.9 : 0.75 }}
                        color={isActive ? theme['c-on-primary'] : theme['c-font']}
                      >{item.count}</Text>
                    )
                  : null
              }
            </TouchableOpacity>
          )
        })
      }
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 31,
    borderRadius: 999,
    paddingHorizontal: 16,
  },
  labelActive: {
    fontFamily: FontFamilies.medium,
  },
  count: {
    marginLeft: 3,
  },
})
