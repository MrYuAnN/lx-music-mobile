import { useMemo } from 'react'

import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import CategoryChips from '@/components/common/CategoryChips'
import { setPlaybackRate, updateMetaData } from '@/plugins/player'
import { setPlaybackRate as setLyricPlaybackRate } from '@/core/lyric'
import playerState from '@/store/player/state'
import Card from './Card'
import styles from './style'

// 倍速行卡（2026-10-20 更多弹层重构拍板「预设胶囊」）：复用 CategoryChips 六预设单选——业界主流
// （B 站预设列表/网易云横排预设/Spotify 循环切换，滑杆自定义小众）；点 1x 即重置（语义内化，
// 原滑杆+重置钮废弃）。非预设历史值（如 0.62x）无勾选态，标题右侧显示当前值小字（审查过渡期
// 补偿），点任一预设即归化、小字消失。
// 2026-10-21 布局治理拍板：block 布局标题独行 + 胶囊 wrap 整行换行全可见（弃横向滚动）、
// glass 玻璃填充 + flush 贴 16dp 单一网格
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default () => {
  const playbackRate = useSettingValue('player.playbackRate')
  const theme = useTheme()
  const t = useI18n()

  const items = useMemo(() => RATES.map(rate => ({ id: String(rate), label: `${rate}x` })), [])
  const isPreset = RATES.some(rate => rate == playbackRate)

  const handleRateChange = (rate: number) => {
    if (playbackRate == rate) return // 同值短路（审查 S-2）：重复点已选预设不重放播放器/通知元数据
    void setPlaybackRate(rate)
    void setLyricPlaybackRate(rate)
    void updateMetaData(playerState.musicInfo, playerState.isPlay, true) // 更新通知栏的播放速率
    updateSetting({ 'player.playbackRate': rate })
  }

  return (
    <Card layout="block">
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('play_detail_setting_playback_rate')}</Text>
        {
          !isPreset
            ? <Text size={12} color={theme['c-font-label']} style={styles.rateText}>{`${playbackRate.toFixed(2)}x`}</Text>
            : null
        }
      </View>
      <CategoryChips
        items={items}
        activeId={String(playbackRate)}
        onChange={id => { handleRateChange(parseFloat(id)) }}
        style={styles.chips}
        fill="glass"
        wrap
        flush
        expandTouch
      />
    </Card>
  )
}
