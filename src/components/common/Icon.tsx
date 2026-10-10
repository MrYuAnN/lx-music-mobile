import { createIconSetFromIcoMoon } from 'react-native-vector-icons'
import icoMoonConfig from '@/resources/fonts/selection.json'
import { ICON_SIZE } from '@/config/constant'
import { memo, type ComponentProps } from 'react'
import { useTheme } from '@/store/theme/hook'
import { type StyleProp, type TextStyle } from 'react-native'

// import IconAntDesign from 'react-native-vector-icons/AntDesign'
// import IconEntypo from 'react-native-vector-icons/Entypo'
// import IconEvilIcons from 'react-native-vector-icons/EvilIcons'
// import IconFeather from 'react-native-vector-icons/Feather'
// import IconFontAwesome from 'react-native-vector-icons/FontAwesome'
// import IconFontAwesome5 from 'react-native-vector-icons/FontAwesome5'
// import IconFontisto from 'react-native-vector-icons/Fontisto'
// import IconFoundation from 'react-native-vector-icons/Foundation'
// import IconIonicons from 'react-native-vector-icons/Ionicons'
// import IconMaterialIcons from 'react-native-vector-icons/MaterialIcons'
// import IconMaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
// import IconOcticons from 'react-native-vector-icons/Octicons'
// import IconZocial from 'react-native-vector-icons/Zocial'
// import IconSimpleLineIcons from 'react-native-vector-icons/SimpleLineIcons'


const IcoMoon = createIconSetFromIcoMoon(icoMoonConfig)


// https://oblador.github.io/react-native-vector-icons/

type IconType = ReturnType<typeof createIconSetFromIcoMoon>

interface IconProps extends Omit<ComponentProps<IconType>, 'style'> {
  style?: StyleProp<TextStyle>
}

// size 为裸 dp 直传（AM-6 拍板：图标脱离 scaleSizeW 体系，不随用户字号缩放），
// 取值一律用 ICON_SIZE token；默认列表行基准，仅兜底——新调用点禁止依赖默认值，必须显式传 token
export const Icon = memo(({ size = ICON_SIZE.list, color, style, ...props }: IconProps) => {
  const theme = useTheme()
  return (
    <IcoMoon
      size={size}
      color={color ?? theme['c-font']}
      // RNV 自带的旧版 @types/react-native 与 RN 本体类型不一致，style 需要抑制
      // @ts-expect-error
      style={style}
      {...props}
    />
  )
})


export {
  // IconAntDesign,
  // IconEntypo,
  // IconEvilIcons,
  // IconFeather,
  // IconFontAwesome,
  // IconFontAwesome5,
  // IconFontisto,
  // IconFoundation,
  // IconIonicons,
  // IconMaterialIcons,
  // IconMaterialCommunityIcons,
  // IconOcticons,
  // IconZocial,
  // IconSimpleLineIcons,
}
