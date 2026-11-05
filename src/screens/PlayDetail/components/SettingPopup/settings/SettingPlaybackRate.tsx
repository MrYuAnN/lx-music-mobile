import { Fragment, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { ICON_SIZE } from '@/config/constant'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { setPlaybackRate, updateMetaData } from '@/plugins/player'
import { setPlaybackRate as setLyricPlaybackRate } from '@/core/lyric'
import playerState from '@/store/player/state'
import { createStyle } from '@/utils/tools'
import Card from './Card'
import sharedStyle from './style'

// 倍速行卡（2026-10-20 更多弹层重构「预设胶囊」→ 2026-11-05 真机反馈两轮演进）：
// 全档位 chips 常驻展示不协调（一轮反馈）→ 单值步进误解为 ▲▼（二轮否决）→ 终态=**内联下拉**：
// 平时只显示当前档位值（右值+caret 提示），点击行/值在该位置上下展开全部档位选项列
// （降序 2x→0.5x，当前档主色+勾选标记，点选即收起归化；非预设历史值仅显示不勾选）。
// 行结构与定时关闭行同构（图标+标题+右值）；选项列满铺 16dp 网格，行语言与弹层一致。
// 图标显式 weight regular 细线（≤20dp 默认 bold 在菜单行显粗笨，与玻璃体系细线语言对齐）
const RATES = [2, 1.5, 1.25, 1, 0.75, 0.5] // 展示序：快在上

const formatRate = (rate: number) => `${rate}x`

export default () => {
  const playbackRate = useSettingValue('player.playbackRate')
  const theme = useTheme()
  const t = useI18n()
  const [expanded, setExpanded] = useState(false)

  const handleRateChange = (rate: number) => {
    if (playbackRate == rate) {
      setExpanded(false) // 点当前档=仅收起
      return
    }
    void setPlaybackRate(rate)
    void setLyricPlaybackRate(rate)
    void updateMetaData(playerState.musicInfo, playerState.isPlay, true) // 更新通知栏的播放速率
    updateSetting({ 'player.playbackRate': rate })
    setExpanded(false)
  }

  return (
    <Card>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.6}
        onPress={() => { setExpanded(!expanded) }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Icon name="playback-rate" size={ICON_SIZE.list} weight="regular" color={theme['c-font']} style={sharedStyle.icon} />
        <Text size={15} style={styles.label}>{t('play_detail_setting_playback_rate')}</Text>
        <Text size={13} color={theme['c-font-label']} style={styles.rateText}>{formatRate(playbackRate)}</Text>
        <Icon
          name={expanded ? 'caret-up' : 'caret-down'}
          size={12}
          weight="regular"
          color={theme['c-font-label']}
          style={styles.caret}
        />
      </TouchableOpacity>
      {
        expanded
          ? (
              <View style={styles.optionList}>
                {RATES.map(rate => {
                  const active = rate == playbackRate
                  return (
                    <Fragment key={rate}>
                      {rate !== RATES[0] ? <View style={[styles.optionDivider, { backgroundColor: theme['c-border-background'] }]} /> : null}
                      <TouchableOpacity
                        style={styles.optionRow}
                        activeOpacity={0.6}
                        onPress={() => { handleRateChange(rate) }}
                        accessibilityRole="button"
                      >
                        <Text size={15} color={active ? theme['c-primary'] : theme['c-font']}>{formatRate(rate)}</Text>
                        {active ? <Icon name="check" size={ICON_SIZE.chevron} weight="regular" color={theme['c-primary']} /> : null}
                      </TouchableOpacity>
                    </Fragment>
                  )
                })}
              </View>
            )
          : null
      }
    </Card>
  )
}

const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    flexGrow: 1,
    flexShrink: 1,
  },
  rateText: {
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  caret: {
    marginLeft: 4,
  },
  // 内联下拉选项列（满铺 16dp 网格，行语言与弹层一致；行间发丝线）
  optionList: {
    paddingBottom: 4,
  },
  optionRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 32, // 对齐标题文字列（icon 20 + gap 12；Card 已有 px16）
  },
  optionDivider: {
    height: 1,
    marginLeft: 32,
  },
})
