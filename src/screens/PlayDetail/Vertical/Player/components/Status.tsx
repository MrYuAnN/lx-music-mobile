import { useStatusText } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { FONT_WHITE_50 } from '../../../constant'


export default () => {
  // const { text } = useLrcPlay()
  const statusText = useStatusText()
  // console.log('render status')

  // const status = playerStatus.isPlay ? text : playerStatus.statusText

  return <Text style={styles.text} numberOfLines={1} size={13} color={FONT_WHITE_50}>{statusText}</Text>
}

const styles = createStyle({
  text: {
    textAlign: 'center',
  },
})
