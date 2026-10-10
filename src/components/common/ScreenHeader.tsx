import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import StatusBar from '@/components/common/StatusBar'
import Text, { FontFamilies } from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { SCREEN_HEADER_HEIGHT, ICON_SIZE } from '@/config/constant'
import { setSpText } from '@/utils/pixelRatio'

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
      height: SCREEN_HEADER_HEIGHT + statusBarHeight,
      paddingTop: statusBarHeight,
      borderBottomWidth: BorderWidths.normal,
      borderBottomColor: theme['c-border-background'],
    }}>
      <StatusBar />
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={back} activeOpacity={0.7}>
          <Icon name="chevron-left" color={theme['c-font']} size={ICON_SIZE.nav} />
        </TouchableOpacity>
        {
          center ?? (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          )
        }
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
    flexGrow: 1,
  },
  backBtn: {
    width: 52,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 0,
  },
  title: {
    flex: 1,
    fontFamily: FontFamilies.semibold,
    fontSize: setSpText(17),
    // AM 二级页标题居左（紧跟返回键），right 插槽占位时由 flex 收窄
    marginRight: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    flexShrink: 0,
  },
})
