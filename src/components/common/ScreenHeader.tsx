import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import Text, { FontFamilies } from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { HEADER_HEIGHT } from '@/config/constant'
import { scaleSizeH, setSpText } from '@/utils/pixelRatio'

interface Props {
  componentId: string
  title?: string
  /** 顶栏中央自定义内容，给出时忽略 title */
  center?: React.ReactNode
  /** 顶栏右侧操作区（如歌单详情的搜索入口） */
  right?: React.ReactNode
}

export default ({ componentId, title, center, right }: Props) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    pop(componentId)
  }

  return (
    <View style={{
      height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
      paddingTop: statusBarHeight,
      borderBottomWidth: BorderWidths.normal,
      borderBottomColor: theme['c-border-background'],
    }}>
      <StatusBar />
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.7}>
          <Icon name="chevron-left" color={theme['c-font']} size={24} />
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
    width: 52,
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
    fontFamily: FontFamilies.semibold,
    fontSize: setSpText(17),
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
})
