# 排行榜页改版 · 定稿方案（2026-10-16）

> grilling 多轮拍板 + 4 轮效果图迭代 + 三席方案审查（1C/5I/8S 全处置）后定稿。
> 审查包：`.review-bundle/2026-10-16/context-leaderboard.md`（含业界调研来源）。
> 效果图：会话可视化 `leaderboard-redesign.html`（用户已逐版验收）。

## 拍板共识（修订后 10 项）

1. **顶栏单淡底胶囊**：`酷我 · 热歌榜 ⌄`——音源短名（12/400 `c-font-label`，`source_short_*`）· 分隔点（`c-250`）· 榜单名（14/600 `c-primary`）+ chevron-down 10px；胶囊底 `c-border-background`；高 28 不随系统字号缩放。
2. **级联 sheet 基于 SheetBase**（审查 I-1 修订，弃 Modal 自建）：`SheetBase(title=「选择榜单」i18n 键, maxHeight='64%')` + 音源 chips 横滑行（全名 `source_real_*`，选中=淡主色底+红字）→ 榜单 FlatList（当前榜主色文字+600 字重，行尾 `⋯` more-vertical）。已知现状：SheetBase 下拉关闭热区仅把手+标题，列表区下拉不关闭（全局行为，验收口径注明）。
3. **先选源后选榜 + 时序守卫**（审查 I-4 修订）：切源刷新榜单列表、默认跳该源第一榜；`onSourceChange` 加请求序号 ref，过期响应丢弃（防快速连点未缓存源时旧响应覆盖 chips 选中/榜单列表/主列表/持久化四方状态）。
4. **`⋯` 平移现有 ActionSheet**（播放/收藏榜单）：`BoardsList/ListMenu.tsx` 保留复用。
5. **抽屉处置（审查 C-1 A 案）**：竖屏 `Vertical/index.tsx` 摘除 DrawerLayoutFixed + BoardsList 引用；`BoardsList/index.tsx`/`List.tsx`/`ListItem.tsx` **保留**（横屏 LeftBar 唯一使用方，零触碰零回归）；sheet 榜单行自建（高亮判断一两行重复可接受，两处形态本已分叉：抽屉行 chevron+长按 vs sheet 行 ⋯）。
6. **孤儿文件删除**（审查 S-1）：`Vertical/HeaderBar/SourceSelector.tsx`、`ActiveListName.tsx`（已核实仅竖屏顶栏引用；通用 `components/SourceSelector.tsx` 与 DorpDownMenu 有其他活调用方，保留）。
7. **序号 A 案淡底徽章 + 播放中规则**（审查 I-5 补）：序号槽 26→32、等宽数字（fontVariant tabular-nums）；前三 22×22/r7 徽章（底=色12%，沿用 QualityTag `getTintBackground` **export 复用**——审查 S-2），数字 13/600 实色（`c-chart-1/2/3`）；4+ 无底 13/500 `c-300`；播放中行沿用现状：整槽让位主色 play-outline 图标（徽章/数字均不显示）。
8. **金银铜 token 三处同步**（审查 I-3 修订）：`src/theme/themes/index.ts`（isDark 分支）+ `src/types/theme.d.ts`（ThemeColors interface + ActiveTheme）+ `src/store/theme/state.ts`（主题色表）。色值：浅 `#A2750A/#7D889C/#A5673E`，深 `#E3B341/#AEB6C6/#C98F68`。
9. **歌单详情 + 我的列表去序号**：`SonglistDetail/MusicList.tsx`、`Mylist/MusicList/List.tsx` 移除 showIndex；全应用收敛为仅排行榜带序号（已核实无外溢）。
10. **不动项**：横屏 `Horizontal/LeftBar`（含 BoardsList 链）零改动；搜索框维持现状；升降/新晋箭头不做（音源无上期位次数据，明示）；设置持久化结构 `{source, boardId}` 不变。

## 改动范围（批次修订后）

**批1**（顶栏 + sheet + 摘抽屉）：
- `Vertical/HeaderBar/index.tsx` 重构：单胶囊触发器；删 `HeaderBar/SourceSelector.tsx`、`ActiveListName.tsx`（孤儿删除）
- 新建 `Vertical/HeaderBar/BoardPickerSheet.tsx`：SheetBase 组合（chips 行 + FlatList + ListMenu 复用）
- `Vertical/index.tsx`：摘 DrawerLayoutFixed/BoardsList 接线；删除三处旧接线——`boardsListRef.setList`（init 与 onSourceChange 内两处）、`handleFixDrawer`/`navActiveIdUpdated` 监听（审查 S-3）
- `lang/zh-cn.json`/`en-us.json`/`zh-tw.json`：sheet 标题键**随批1**（审查 I-2，消除依赖倒置）
- 伴随修复（审查 S-6）：`common/Modal.tsx:80` `useMemo(async() => children)` 去 async

**批2**（序号 + token + 去序号）：
- `components/OnlineList/ListItem.tsx`：序号徽章 + 槽 32 + 等宽；`QualityTag.tsx` export `getTintBackground`
- token 三处同步（见拍板 8）
- `SonglistDetail/MusicList.tsx`、`Mylist/MusicList/List.tsx` 移除 showIndex

## 验收清单（真机 N2）

胶囊显示/点击与浅深主题；sheet 级联（切源刷新、当前榜高亮、⋯播放/收藏、弱网切源空窗口径）；序号前三徽章（含两位/三位数不溢出、**银档浅色可读性**——审查 S-7）+ 播放中行互斥 + 4+ 无徽章；冷启动恢复上次 `{source, boardId}`；搜索/歌单/我的列表无序号回归；横屏 LeftBar 零变化确认；系统大字号不挤压。

## 回滚

每批独立 commit，revert 单批即可；无数据迁移。批1 修订后为自洽可回滚单元（i18n 键已随批）。

## 实施勘误与代码审查处置（2026-10-16）

- **实现勘误**：sheet 榜单列表用 ScrollView+map 而非拍板 2 字面的 FlatList（量级 ≤50，对齐 BoardsList/List.tsx 现状模式）；chevron-down 以 chevron-right 旋转 90° 复用（图标集无该字形，零资源变更）——均视觉/功能等效，备查防误修。
- **代码审查（三席 0C/4I/7S 合并）处置**：I-A 切源窗口一致性族=「boards 所属源单一事实源」重构（boardsSourceRef、切源清列表、show/切源同 seq、失败回滚 chips+toast、数据获取单链在 sheet）；I-B init 纳入父层 seq；I-C 浅色三色加深至淡底上 ≥4.5:1（金 #8B6509/银 #616C80/铜 #965E38，保持色相降亮度实测求解）；I-D 4+ 名补 medium(500)。S-1 selectInfoRef 死代码/S-3 空榜名段不渲染/S-5 非当前榜 ⋯ 播放改按 id 拉取/S-6 Modal memoChildren 删除/S-7 本节勘误，均采纳；S-2 双请求与 S-4 闪旧列表随 I-A 单链顺手消除；宽松相等跟随项目现状不改。新增 i18n 键：load_failed_tip（三语）。
- 修复后 tsc 全量 + eslint 批内文件再次全绿。

- **二次真机勘误（2026-10-17 三席审查 S-H/C1 补记）**：顶栏胶囊触发器高 28→38（2026-10-16 真机反馈与搜索页 SearchBar 统一规格；内 12/14 两种字号统一 lineHeight 18 保基线齐）；触发器底色实现曾漂移 `c-content-background`，2026-10-17 三席审查 C1 修复回归本拍板字面 `c-border-background`。其余漂移（ScrollView/FlatList、chevron 旋转）见上节勘误。
