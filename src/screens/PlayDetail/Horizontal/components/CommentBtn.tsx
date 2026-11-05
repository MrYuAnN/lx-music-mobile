import Btn from './Btn'
import { pushScreen } from '@/navigation'
import { COMMENT_SCREEN } from '@/navigation/screenNames'


export default () => {
  const handleShowCommentScreen = () => {
    pushScreen(COMMENT_SCREEN)
  }

  return <Btn icon="comment" onPress={handleShowCommentScreen} />
}
