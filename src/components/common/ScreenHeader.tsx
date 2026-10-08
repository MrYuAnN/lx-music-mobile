import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

interface Props {
  componentId: string
  title?: string
  /** 顶栏中央自定义内容（如搜索屏的 SearchTypeSelector），给出时忽略 title */
  center?: React.ReactNode
  /** 顶栏右侧操作区（如歌单详情的搜索入口） */
  right?: React.ReactNode
}

export default ({ componentId, title, center, right }: Props) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    void pop(componentId)
  }

  return (
    <View style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }}>
      <StatusBar />
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.7}>
          <Icon name="chevron-left" color={theme['c-font']} size={18} />
        </TouchableOpacity>
        <View style={styles.center}>
          {
            center ?? (
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            )
          }
        </View>
        <View style={styles.right}>
          {right}
        </View>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  backBtn: {
    width: HEADER_HEIGHT,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 0,
  },
  center: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
})
