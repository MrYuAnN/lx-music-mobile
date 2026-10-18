import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import SheetBase, { type SheetBaseType } from '@/components/common/SheetBase'
import Text, { FontFamilies } from '@/components/common/Text'
import DotsVertical from '@/components/common/DotsVertical'
import ListMenu, { type ListMenuType } from '../../BoardsList/ListMenu'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { SPACING } from '@/config/spacing'
import { getBoardsList } from '@/core/leaderboard'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'

// 榜单选择级联 sheet（拍板：顶栏单胶囊唤起的唯一选择容器，SheetBase 单源基座）：
// 音源 chips 先选（源是榜单前置维度）→ 榜单列表后选。
// 一致性模型（代码审查 I-A 一次收口）：boards 以 boardsSourceRef 标记实际所属源（单一事实源），
// 行回调一律取 boardsSourceRef 而非 chips 选中态；切源先清列表（网络窗口内无旧源数据可点）；
// show 与切源共用同一请求序号（过期响应丢弃）；失败回滚 chips 到数据所属源、列表恢复上次成功数据并 toast。
// 数据获取单链在本组件（父层免守卫）：切源拿到榜单后经 onSourceChange 上交父级应用第一榜。
// 榜单量级 ≤50，ScrollView+map 对齐 BoardsList/List.tsx 现状模式。
export interface ShowInfo {
  source: LX.OnlineSource
  activeId: string
}

export interface BoardPickerSheetProps {
  onBoundSelect: (source: LX.OnlineSource, id: string, name: string) => void
  onSourceChange: (source: LX.OnlineSource, board: BoardItem) => void
  onPlay: (listId: string) => void
  onCollect: (listId: string, name: string) => void
}

export interface BoardPickerSheetType {
  show: (info: ShowInfo) => void
}

export default forwardRef<BoardPickerSheetType, BoardPickerSheetProps>(({ onBoundSelect, onSourceChange, onPlay, onCollect }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const sheetRef = useRef<SheetBaseType>(null)
  const listMenuRef = useRef<ListMenuType>(null)
  const sourceSeqRef = useRef(0)
  const boardsSourceRef = useRef<LX.OnlineSource>('kw')
  // 上次成功拉取的榜单数据（三席审查 S-B）：失败回滚时列表一并恢复，不再停留清空态
  const lastGoodBoardsRef = useRef<{ source: LX.OnlineSource, list: BoardItem[] } | null>(null)
  // source=chips 选中态（目标源）；boards 恒与 boardsSourceRef 成对更新
  const [source, setSource] = useState<LX.OnlineSource>('kw')
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [activeId, setActiveId] = useState('')

  const applyBoards = (targetSource: LX.OnlineSource, list: BoardItem[]) => {
    boardsSourceRef.current = targetSource
    lastGoodBoardsRef.current = { source: targetSource, list }
    setBoards(list)
  }

  // 失败回滚（show 与切源共用）：chips 回到数据所属源 + 列表恢复上次成功数据
  const rollbackBoards = () => {
    setSource(boardsSourceRef.current)
    const last = lastGoodBoardsRef.current
    if (last) setBoards(last.list)
  }

  useImperativeHandle(ref, () => ({
    show(info) {
      const seq = ++sourceSeqRef.current
      setSource(info.source)
      setActiveId(info.activeId)
      // 上次会话残留他源列表时先清（同源重开直接复用已有数据，无闪烁）
      if (boardsSourceRef.current != info.source) setBoards([])
      sheetRef.current?.setVisible(true)
      void getBoardsList(info.source).then(list => {
        if (seq != sourceSeqRef.current) return
        applyBoards(info.source, list)
      }).catch(() => {
        if (seq != sourceSeqRef.current) return
        rollbackBoards()
        toast(t('load_failed_tip'))
      })
    },
  }), [t])

  const handleSourcePress = (nextSource: LX.OnlineSource) => {
    if (nextSource == source) return
    const seq = ++sourceSeqRef.current
    setSource(nextSource)
    if (boardsSourceRef.current != nextSource) setBoards([])
    void getBoardsList(nextSource).then(list => {
      if (seq != sourceSeqRef.current) return
      applyBoards(nextSource, list)
      const board = list[0]
      if (board) {
        setActiveId(board.id)
        onSourceChange(nextSource, board)
      }
    }).catch(() => {
      if (seq != sourceSeqRef.current) return
      rollbackBoards() // 回滚 chips 到数据实际所属源 + 恢复上次成功列表
      toast(t('load_failed_tip'))
    })
  }

  const handleBoundPress = (item: BoardItem) => {
    onBoundSelect(boardsSourceRef.current, item.id, item.name)
    sheetRef.current?.setVisible(false)
  }

  const handleShowMenu = (item: BoardItem, index: number) => {
    // position 为老 UI（锚定菜单）遗留参数，ActionSheet 形态不消费，传零值占位
    listMenuRef.current?.show({ listId: item.id, name: item.name, index }, { x: 0, y: 0, w: 0, h: 0 })
  }

  return (
    <SheetBase ref={sheetRef} title={t('leaderboard_select_board')} maxHeight="64%">
      {/* 「音源」分区标题：与歌单 SonglistPickerSheet 同构（2026-10-18 真机反馈轮统一两弹层分区） */}
      <Text style={styles.zoneLabel} size={12} color={theme['c-font-label']}>{t('filter_source')}</Text>
      <ScrollView horizontal style={styles.srcRow} contentContainerStyle={styles.srcRowContent} showsHorizontalScrollIndicator={false}>
        {
          leaderboardState.sources.map(s => {
            const active = s == source
            return (
              <TouchableOpacity
                key={s}
                style={{ ...styles.srcChip, backgroundColor: active ? theme['c-primary-alpha-900'] : theme['c-border-background'] }}
                activeOpacity={0.6}
                onPress={() => { handleSourcePress(s) }}
              >
                <Text size={13} numberOfLines={1} color={active ? theme['c-primary'] : theme['c-font-label']}>{t(`source_real_${s}`)}</Text>
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>
      {/* 「榜单」分区标题：与歌单弹层 zone 标题同构（真机反馈轮 2 轮补） */}
      <Text style={styles.boardsLabel} size={12} color={theme['c-font-label']}>{t('leaderboard_zone_boards')}</Text>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {
          boards.map((item, index) => {
            const active = item.id == activeId
            return (
              <View key={item.id} style={styles.row}>
                <TouchableOpacity style={styles.rowMain} activeOpacity={0.6} onPress={() => { handleBoundPress(item) }}>
                  <Text
                    size={15}
                    numberOfLines={1}
                    color={active ? theme['c-primary'] : theme['c-font']}
                    style={active ? styles.rowNameActive : undefined}
                  >{item.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} onPress={() => { handleShowMenu(item, index) }}>
                  {/* 三点恒竖向（项目级 UI 约定）：Icon 的 dots-vertical glyph 实为横向三点，不可用 */}
                  <DotsVertical color={theme['c-250']} />
                </TouchableOpacity>
              </View>
            )
          })
        }
      </ScrollView>
      <ListMenu
        ref={listMenuRef}
        onHideMenu={() => {}}
        onPlay={({ listId }) => { onPlay(listId) }}
        onCollect={({ listId, name }) => { onCollect(listId, name) }}
      />
    </SheetBase>
  )
})

const styles = createStyle({
  // zone 标题间距与歌单 SonglistPickerSheet 同构（二轮审查 S-3 统一 s10/s8）
  zoneLabel: {
    marginTop: SPACING.s10,
    marginBottom: SPACING.s8,
    paddingHorizontal: SPACING.s20,
  },
  boardsLabel: {
    marginBottom: SPACING.s8,
    paddingHorizontal: SPACING.s20,
  },
  // 来源行不参与压缩（flexShrink:0）：sheet 内容超限时此前与榜单列表按 shrink 比例分摊，
  // chips 被纵向裁掉上半（真机反馈 2026-10-16）；限高滚动由榜单列表独自承担
  srcRow: {
    flexGrow: 0,
    flexShrink: 0,
  },
  srcRowContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  srcChip: {
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingLeft: 20,
    paddingRight: 8,
  },
  rowMain: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingRight: 6,
  },
  rowNameActive: {
    fontFamily: FontFamilies.semibold,
  },
  moreBtn: {
    width: 40,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
