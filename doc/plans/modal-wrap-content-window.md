# Modal 包内容小窗改造（2026-10-19 立项，待验证）

> 状态：立项待验证。起因：新建歌单弹窗在 HyperOS（PolicyMaker）上「键盘弹着时输入框外首击被系统窗口层征用收键盘、touch 不进 app」，全屏 RN Modal 窗口形态无法绕过；同设备净屏（RethinkDNS 换壳 com.jingping.app）原生小窗可一步关闭，dumpsys 对比实锤窗口形态差异。

## 实证结论（2026-10-19 dumpsys）

- 我们：RN Modal → Dialog `ty=APPLICATION fillxfill` 全屏、`sim=adjust=resize`、自绘遮罩；InputDispatcher `touchableRegion=[0,0][1440,3200]`。键盘弹着时首击（遮罩/空白/按钮一致）不达 RN（onPressIn 触点实验证伪移动靶论）。
- 净屏：`KeyInfoActivity` 对话框主题 activity，`mAttrs=(1320xwrap) gr=CENTER sim=adjust=pan fl=DIM_BEHIND`，实际 frame 1320×1181 居中；窗外点击走系统 outside 通道一步关（键盘+弹窗同收）。
- 设备：HyperOS（MIUI，PolicyMaker 服务、GestureStub 手势窗、`InputFilterEnabled=true`）；输入法搜狗小米版（IME touchableRegion 仅键盘区 y≥1957，排除 IME 吞噬）。

## 方案要点（待验证）

1. patch `ReactModalHostView.kt` + `ReactModalHostManager`：新增 JS prop（如 `wrapContent`）→ 窗口 `setLayout` 包宽/包高 + `FLAG_DIM_BEHIND` 系统压暗（去自绘遮罩）+ `SOFT_INPUT_ADJUST_PAN`；对照净屏参数。
2. RN 内容在非全屏窗口的测量问题：先试 wrap 让内容自适应；不行则 JS onLayout 量高 → 原生 setDialogHeight(px) 兜底。
3. 范围控制：prop 门控，仅 InputSheet（新建歌单）切小窗；其余 Modal 不动，回归面最小。
4. 预期：窗外点击（遮罩）一击全关回归；窗口内按钮键盘开着时**可能仍两击**（同在焦点窗内，是否豁免未知，验了才知道）；完成键直提不受影响。

## 验收

- 键盘开着：点窗外一击全关（键盘+弹窗同帧）；点确认第二击生效且草稿不丢；完成键一击创建。
- 全 Modal 家族回归：ActionSheet/CheckSheet/PlayListPanel/confirmDialog 不受 prop 门控影响。
- 暗色/横竖屏/手势条 inset 走查。

## 后记（2026-10-19 深夜）：项目降级——放行实验已满足全部诉求

- 原始动机（绕开全屏窗首击征用）已被 **KeyboardPassThroughCallback**（UtilsModule onExtraWindowCreate 挂 Window.Callback 包装，Kotlin 委托）满足：ACTION_DOWN 焦点在输入框外 → 自收键盘（clearFocus+hideSoftInputFromWindow）但不消费事件。真机验证：确认/取消/遮罩全部一击完成、键盘+弹窗同收。
- **层级判决（SheetInputProbe 实验）**：首击能到达 Dialog 窗口 Window.Callback 层；吞击发生在窗口内更内层的链路（与 IME 收起动作并发相关）。原生「收键盘+放行」模式下系统策略无从触发。
- 本项目（窗口形态改造）降级为远期可选优化项；若未来放行模式在部分 ROM 失效，再按本档方案重启。

## 影响面声明与验收清单（2026-10-19 三席审查 I-7 补）

- **放行件影响面**：KeyboardPassThroughCallback 在 `onExtraWindowCreate` 无条件挂载，生效范围=**全部 RN Modal Dialog 窗口**（非仅新建歌单弹层）；行为=「键盘弹着时点击输入框外先收键盘再放行点击」的标准 Android 语义，无输入框的弹层（ActionSheet/CheckSheet 等）仅透传无感知。重入防御+探针日志门控已随三席审查 S-1/S-2 处置。
- **装机验收补充清单（全 Modal 家族键盘态回归）**：①ListNameEdit 改名/编辑封面（ConfirmAlert+键盘）；②重名确认 confirmDialog；③ActionSheet/CheckSheet 常规点按；④新建歌单全流程（主验已过，复归一次）。
