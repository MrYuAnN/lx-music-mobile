import { createIconSetFromIcoMoon } from 'react-native-vector-icons'
import icoMoonConfig from '@/resources/fonts/selection.json'
import { scaleSizeW } from '@/utils/pixelRatio'
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
  rawSize?: number
}

export const Icon = memo(({ size = 15, rawSize, color, style, ...props }: IconProps) => {
  const theme = useTheme()
  return (
    <IcoMoon
      size={rawSize ?? scaleSizeW(size)}
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
