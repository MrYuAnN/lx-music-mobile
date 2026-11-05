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

// 倍速行卡（2026-10-20「预设胶囊」→ 2026-11-05 真机反馈四轮演进终态=**行内横排档位**，
// 对标抖音倍速行）：档位纯文字横排嵌在行右区——无胶囊底块无浮层，当前档品牌红、其余次级灰，
// 与菜单行统一行语言；整行高 44 承载触控（每档水平 padding 6 扩命中区）。展示格式对齐抖音
// （整数档补 .0：0.5/0.75/1.0/1.25/1.5/2.0）。历史脉络：全档位胶囊（不精致）→ 浮层菜单
// （层级跳出不一体化）→ 行内文字组（终态）。图标显式 weight regular 细线
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

// 展示格式（抖音同款：整数档补 .0 对齐小数点节奏）
const RATE_LABELS: Record<string, string> = { '0.5': '0.5', '0.75': '0.75', '1': '1.0', '1.25': '1.25', '1.5': '1.5', '2': '2.0' }
const formatRate = (rate: number) => RATE_LABELS[String(rate)] ?? `${rate}`

export default () => {
  const playbackRate = useSettingValue('player.playbackRate')
  const theme = useTheme()
  const t = useI18n()

  const handleRateChange = (rate: number) => {
    if (playbackRate == rate) return // 同值短路（审查 S-2）：重复点已选档不重放播放器/通知元数据
    void setPlaybackRate(rate)
    void setLyricPlaybackRate(rate)
    void updateMetaData(playerState.musicInfo, playerState.isPlay, true) // 更新通知栏的播放速率
    updateSetting({ 'player.playbackRate': rate })
  }

  return (
    <Card>
      <View style={styles.container}>
        <Icon name="playback-rate" size={ICON_SIZE.list} weight="regular" color={theme['c-font']} style={sharedStyle.icon} />
        <Text size={15} style={styles.label}>{t('play_detail_setting_playback_rate')}</Text>
        <View style={styles.rateGroup}>
          {RATES.map(rate => {
            const active = rate == playbackRate
            return (
              <TouchableOpacity
                key={rate}
                style={styles.rateItem}
                activeOpacity={0.6}
                onPress={() => { handleRateChange(rate) }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text size={14} color={active ? theme['c-primary'] : theme['c-font-label']} style={styles.rateText}>{formatRate(rate)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
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
    flexShrink: 1,
  },
  // 行内横排档位组（抖音同构）：纯文字无底块，均匀分布占满右区
  rateGroup: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginLeft: 8,
  },
  rateItem: {
    paddingHorizontal: 3,
    paddingVertical: 10,
  },
  rateText: {
    fontVariant: ['tabular-nums'],
  },
})
