import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text, { FontFamilies } from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { getLeaderboardSetting } from '@/utils/data'
import { createStyle } from '@/utils/tools'
import { SPACING } from '@/config/spacing'
import BoardPickerSheet, { type BoardPickerSheetProps, type BoardPickerSheetType } from './BoardPickerSheet'

export interface HeaderBarProps {
  onBoundSelect: BoardPickerSheetProps['onBoundSelect']
  onSourceChange: BoardPickerSheetProps['onSourceChange']
  onPlay: BoardPickerSheetProps['onPlay']
  onCollect: BoardPickerSheetProps['onCollect']
}

export interface HeaderBarType {
  setBound: (source: LX.OnlineSource, id: string, name: string) => void
}

// 排行榜顶栏（拍板定稿）：单淡底字段形触发器（r8 同构搜索框，单选字段非 chips 故不用胶囊 r999）「酷我 · 热歌榜 ⌄」——音源短名（前置维度）
// · 分隔点 · 当前榜名（主位），点开唯一级联 sheet；原音源下拉+榜单名双控件移除。
// 高 28 不随系统字号缩放（Text 组件默认 allowFontScaling=false，SearchBar h38 同策）；
// 图标集无 chevron-down，以 chevron-right 旋转 90° 复用（零资源变更）。
export default forwardRef<HeaderBarType, HeaderBarProps>(({ onBoundSelect, onSourceChange, onPlay, onCollect }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const sheetRef = useRef<BoardPickerSheetType>(null)
  const [source, setSource] = useState<LX.OnlineSource>('kw')
  const [boardId, setBoardId] = useState('')
  const [boardName, setBoardName] = useState('')

  // 冷启动防闪（三席审查 S-D）：源初值不再硬编码 'kw'，挂载即读持久化同步 chips——
  // 非酷我用户首帧不闪「酷我」；榜单名仍随父层 init 网络返回（空名不渲染已由审查 S-3 处理）
  useEffect(() => {
    void getLeaderboardSetting().then(({ source: persisted }) => {
      setSource(persisted)
    }).catch(() => {})
  }, [])

  useImperativeHandle(ref, () => ({
    setBound(nextSource, id, name) {
      setSource(nextSource)
      setBoardId(id)
      setBoardName(name)
    },
  }), [])

  const showPicker = () => {
    sheetRef.current?.show({ source, activeId: boardId })
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={{ ...styles.chip, backgroundColor: theme['c-border-background'] }} activeOpacity={0.6} onPress={showPicker}>
        <Text size={12} style={styles.chipText} color={theme['c-font-label']}>{t(`source_short_${source}`)}</Text>
        {
          boardName
            ? (
                // 榜名未就绪（init 网络返回前）时不渲染分隔点与空段，避免「酷我 ·  ⌄」（审查 S-3）
                <>
                  <Text size={12} style={styles.chipText} color={theme['c-250']}>·</Text>
                  <Text size={14} color={theme['c-primary']} numberOfLines={1} style={styles.boardName}>{boardName}</Text>
                </>
              )
            : null
        }
        <Icon name="chevron-right" size={10} color={theme['c-font-label']} style={styles.caret} />
      </TouchableOpacity>
      <BoardPickerSheet
        ref={sheetRef}
        onBoundSelect={onBoundSelect}
        onSourceChange={onSourceChange}
        onPlay={onPlay}
        onCollect={onCollect}
      />
    </View>
  )
})

// 顶栏容器与触发器同构搜索页（SearchBar box h38/r8/ph10、container pt8 无底线）——2026-10-16 真机反馈统一规格
const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.s16,
    paddingTop: SPACING.s8,
    paddingBottom: SPACING.s8,
    zIndex: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 38,
    borderRadius: 8,
    paddingHorizontal: SPACING.s10,
  },
  // 胶囊内 12/14 两种字号统一行高：Android 各自行盒高度不同会导致基线不齐（真机反馈 2026-10-16）
  chipText: {
    lineHeight: 18,
  },
  boardName: {
    fontFamily: FontFamilies.semibold,
    lineHeight: 18,
  },
  caret: {
    transform: [{ rotate: '90deg' }],
  },
})
