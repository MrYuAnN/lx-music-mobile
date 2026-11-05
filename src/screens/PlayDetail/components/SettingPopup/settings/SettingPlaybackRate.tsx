import { View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import DorpDownMenu from '@/components/common/DorpDownMenu'
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

// 倍速行卡（2026-10-20 更多弹层重构「预设胶囊」→ 2026-11-05 真机反馈三轮演进终态）：
// 全档位 chips 常驻（不协调）→ 内联展开选项列（把弹层区域撑大，三轮否决）→ 终态=**锚定下拉
// 浮层**（DorpDownMenu 现成件，同搜索页来源切换先例）：平时只显示当前档位值+caret 提示，点击
// 弹出浮层档位菜单（当前档 activeId 高亮；非预设历史值无高亮仅显示），点选即回调落盘；浮层
// 悬浮于内容之上零布局影响，空间不足自动向上翻转。行结构与定时关闭行同构（图标+标题+右值）。
// 图标显式 weight regular 细线（≤20dp 默认 bold 在菜单行显粗笨，与玻璃体系细线语言对齐）
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

const formatRate = (rate: number) => `${rate}x`

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
        <DorpDownMenu
          menus={RATES.map(rate => ({ action: String(rate), label: formatRate(rate) }))}
          activeId={String(playbackRate)}
          onPress={menu => { handleRateChange(parseFloat(menu.action)) }}
          anchorActive
          fitMenuWidth
          fontSize={13}
        >
          <View style={styles.rateBtn}>
            <Text size={13} color={theme['c-font-label']} style={styles.rateText}>{formatRate(playbackRate)}</Text>
          </View>
        </DorpDownMenu>
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
    flexGrow: 1,
    flexShrink: 1,
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  rateText: {
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
})
