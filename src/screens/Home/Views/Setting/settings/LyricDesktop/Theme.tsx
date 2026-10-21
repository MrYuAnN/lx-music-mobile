import { applyDesktopLyricTheme, desktopLyricThemes, type DesktopLyricTheme } from '@/core/desktopLyric'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { StyleSheet, View, TouchableOpacity } from 'react-native'

import SubTitle from '../../components/SubTitle'
import { SPACING } from '@/config/spacing'

const ThemeItem = ({ color, change }: {
  color: DesktopLyricTheme
  change: (color: DesktopLyricTheme) => void
}) => {
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.5} onPress={() => { change(color) }}>
      <View style={styles.colorContent}>
        <View style={{ ...styles.image, backgroundColor: color }}></View>
      </View>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const t = useI18n()

  const setThemeDesktopLyric = (color: DesktopLyricTheme) => {
    void applyDesktopLyricTheme(color)
  }

  return (
    <SubTitle title={t('setting_lyric_desktop_theme')}>
      <View style={styles.list}>
        {
          desktopLyricThemes.map((c, i) => <ThemeItem key={i.toString()} color={c} change={setThemeDesktopLyric} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    marginRight: SPACING.s16,
    marginTop: SPACING.s6,
    alignItems: 'center',
    width: 26,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  colorContent: {
    width: 26,
    height: 26,
    borderRadius: 4,
    // borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 20,
    height: 20,
    borderRadius: 4,
    elevation: 1,
  },
})
