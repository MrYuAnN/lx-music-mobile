import { useRef } from 'react'
import { TouchableOpacity } from 'react-native'

import PageContent from '@/components/PageContent'
import ScreenHeader from '@/components/common/ScreenHeader'
import { Icon } from '@/components/common/Icon'
import PlayerBar from '@/components/player/PlayerBar'
import { useTheme } from '@/store/theme/hook'
import MusicList, { type MusicListType } from '@/screens/Home/Views/Mylist/MusicList'
import { createStyle } from '@/utils/tools'
import { type MylistDetailInfo } from '@/navigation/navigation'

interface Props {
  componentId: string
  info: MylistDetailInfo
}

export default ({ componentId, info }: Props) => {
  const theme = useTheme()
  const musicListRef = useRef<MusicListType>(null)

  return (
    <PageContent>
      <ScreenHeader
        componentId={componentId}
        title={info.name}
        right={
          <TouchableOpacity style={styles.searchBtn} onPress={() => { musicListRef.current?.showSearch() }} activeOpacity={0.7}>
            <Icon name="search-2" color={theme['c-font']} size={18} />
          </TouchableOpacity>
        }
      />
      <MusicList ref={musicListRef} />
      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
  searchBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
