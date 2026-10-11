import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import Animated from 'react-native-reanimated'
import { BorderWidths } from '@/theme'
import ButtonBar from './ActionBar'
import { useIntroStyle } from '@/navigation/transitions/intro'
import { useCoverFlyTarget } from '@/navigation/transitions/coverFly'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import Text, { AnimatedText } from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import Image from '@/components/common/Image'
import { useListInfo } from './state'
import { useAnimateOnecNumber } from '@/utils/hooks/useAnimateNumber'
import { useStatusbarHeight } from '@/store/common/hook'
import { SPACING } from '@/config/spacing'

const IMAGE_WIDTH = scaleSizeW(70)

const CountText = memo(({ count }: { count: string }) => {
  const [animFade] = useAnimateOnecNumber(0, 1, 250, false)
  const [animTranslateY] = useAnimateOnecNumber(10, 0, 250, false)
  return (
    <AnimatedText style={{
      ...styles.playCount,
      opacity: animFade,
      transform: [
        { translateY: animTranslateY },
      ],
    }} numberOfLines={ 1 }>{count}</AnimatedText>
  )
}, (prevProps, nextProps) => {
  return true
})

const Pic = ({ playCount, imgUrl }: {
  playCount: string
  imgUrl?: string
}) => {
  const [pic, setPic] = useState(imgUrl)
  const info = useListInfo()
  // 封面飞入目标侧（RNN sharedElement 的 reanimated 等价）：飞行落定前隐藏原图，落定语义
  // 与原 appear 驱动的 animated 一致（播放数淡入、图刷新同拍）
  const { ref, onLayout, settled, imageStyle } = useCoverFlyTarget(info.id)
  useEffect(() => {
    if (settled) setPic(imgUrl)
  }, [imgUrl, settled])

  return (
    <View ref={ref} onLayout={onLayout} style={{ ...styles.listItemImg, width: IMAGE_WIDTH, height: IMAGE_WIDTH }}>
      <Image nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`} url={pic} style={{ flex: 1, borderRadius: 4, ...(imageStyle ?? {}) }} />
      {
        playCount && settled ? <CountText count={playCount} /> : null
      }
    </View>
  )
}

export interface HeaderProps {
  componentId: string
}

export interface HeaderType {
  setInfo: (info: DetailInfo) => void
}
export interface DetailInfo {
  name: string
  desc: string
  playCount: string
  imgUrl?: string
}

export default forwardRef<HeaderType, HeaderProps>((_props, ref) => {
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()
  const info = useListInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', playCount: '', imgUrl: info.img })
  // 标题元素进出场（RNN elementTransitions 等价：alpha 0→1 + translationX 16→0）
  const titleIntroStyle = useIntroStyle('title')

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  return (
    <View style={{ ...styles.container, paddingTop: statusBarHeight, borderBottomColor: theme['c-border-background'] }}>
      <View style={{ flexDirection: 'row', flexGrow: 0, flexShrink: 0, padding: SPACING.s10 }}>
        <Pic playCount={detailInfo.playCount} imgUrl={detailInfo.imgUrl} />
        <Animated.View
          style={[{ flexDirection: 'column', flexGrow: 1, flexShrink: 1, paddingLeft: SPACING.s6 }, titleIntroStyle]}
          nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}
        >
          <Text size={14} numberOfLines={ 1 }>{detailInfo.name}</Text>
          <View style={{ flexGrow: 0, flexShrink: 1 }}>
            <Text size={13} color={theme['c-font-label']} numberOfLines={ 4 }>{detailInfo.desc}</Text>
          </View>
        </Animated.View>
      </View>
      <ButtonBar />
      {/* <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexGrow: 0, flexShrink: 1, paddingTop: SPACING.s6, paddingRight: SPACING.s6 }}>
              <Text style={{ fontSize: 12, color: AppColors.normal20 }} numberOfLines={ 1 }>{playCount || '-'}</Text>
              <Text style={{ fontSize: 12, color: AppColors.normal30 }} numberOfLines={ 1 }>{this.props.selectListInfo.author || this.props.listDetailData.info.author}</Text>
            </View>
      </View> */}
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    borderBottomWidth: BorderWidths.normal,
  },
  listItemImg: {
    // backgroundColor: '#eee',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    // width: 70,
    // height: 70,
    // ...Platform.select({
    //   ios: {
    //     shadowColor: '#000',
    //     shadowOffset: {
    //       width: 0,
    //       height: 1,
    //     },
    //     shadowOpacity: 0.20,
    //     shadowRadius: 1.41,
    //   },
    //   android: {
    //     elevation: 2,
    //   },
    // }),
  },
  playCount: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    fontSize: 12,
    paddingLeft: SPACING.s4,
    paddingRight: SPACING.s4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
})
