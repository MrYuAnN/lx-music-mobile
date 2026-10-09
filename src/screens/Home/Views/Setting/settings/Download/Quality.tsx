import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'

const QUALITYS: LX.Quality[] = ['128k', '320k', 'flac']

const useActive = (id: LX.Quality) => {
  const q = useSettingValue('download.quality')
  const isActive = useMemo(() => q == id, [q, id])
  return isActive
}

const Item = ({ id }: { id: LX.Quality }) => {
  const isActive = useActive(id)
  return <CheckBox marginRight={8} check={isActive} label={id} onChange={() => { updateSetting({ 'download.quality': id }) }} need />
}

export default memo(() => {
  return (
    <View style={styles.list}>
      {
        QUALITYS.map((q) => <Item id={q} key={q} />)
      }
    </View>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
