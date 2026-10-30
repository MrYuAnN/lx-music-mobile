import { forwardRef, type Ref, useImperativeHandle, useMemo, useState, type JSX } from 'react'
import { View } from 'react-native'

import DorpDownMenu, { type DorpDownMenuProps as _DorpDownMenuProps } from '@/components/common/DorpDownMenu'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'

import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'

type Sources = Readonly<Array<SY.OnlineSource | 'all'>>

export interface SourceSelectorProps<S extends Sources> {
  fontSize?: number
  center?: _DorpDownMenuProps<any>['center']
  onSourceChange: (source: S[number]) => void
}

export interface SourceSelectorType<S extends Sources> {
  setSourceList: (list: S, activeSource: S[number]) => void
}

export const useSourceListI18n = (list: Sources) => {
  const t = useI18n()
  return useMemo(() => {
    return list.map(s => ({ label: t(`source_real_${s}`), action: s }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, t])
}

const Component = <S extends Sources>({ fontSize = 15, center, onSourceChange }: SourceSelectorProps<S>, ref: Ref<SourceSelectorType<S>>) => {
  const [list, setList] = useState([] as unknown as S)
  const [source, setSource] = useState<S[number]>('kw')
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    setSourceList(list, activeSource) {
      setList(list)
      setSource(activeSource)
    },
  }), [])

  const sourceList_t = useSourceListI18n(list)

  type DorpDownMenuProps = _DorpDownMenuProps<typeof sourceList_t>

  const handleChangeSource: DorpDownMenuProps['onPress'] = ({ action }) => {
    onSourceChange(action)
    setSource(action)
  }

  return (
    <DorpDownMenu
      menus={sourceList_t}
      center={center}
      onPress={handleChangeSource}
      fontSize={fontSize}
      activeId={source}
    >
      <View style={styles.sourceMenu}>
        <Text style={{ textAlign: center ? 'center' : 'left' }} numberOfLines={1} size={fontSize}>{t(`source_real_${source}`)}</Text>
      </View>
    </DorpDownMenu>
  )
}

export default forwardRef(Component) as <S extends Sources>(p: SourceSelectorProps<S> & { ref?: Ref<SourceSelectorType<S>> }) => JSX.Element | null


const styles = createStyle({
  sourceMenu: {
    height: '100%',
    justifyContent: 'center',
    // paddingTop: 12,
    // paddingBottom: 12,
    paddingLeft: SPACING.s16,
    paddingRight: SPACING.s16,
    // backgroundColor: '#ccc',

  },
})
