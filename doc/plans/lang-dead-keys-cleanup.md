# lang 死键清理批（A6 缩水批挂账项）

状态: 已立项待排期（2026-11-05，A6 缩水批收官时用户拍板立项）
前置: scripts/check-lang.mjs 已落地（b6e51e08），KNOWN_DEAD_KEYS 为本批唯一键源
关联: docs/adr/0002-lang-key-drift-defense.md（登记源）；.review-bundle/2026-11-05-lang-plan/

## 范围

`scripts/check-lang.mjs` 的 `KNOWN_DEAD_KEYS` 数组 **39 个键** × 三语 JSON（zh-cn/zh-tw/en-us）同步删除。键清单以脚本数组为单源（勿在本文件抄录副本防漂移）。

死键判定证据（首跑甄别 2026-11-05）：全键名带引号/词边界 grep 零命中 + 词根不在全仓 AST 模板 heads；实际调用键名不同证据例：`download_paused` 非 `download_pause`、`exit_app_tip` 非 `exit_app`、`collect_success` 非 `collect_songlist`（上游 lx-music 遗留或本 fork 改版退役）。

## 天然护栏（误删零风险论证）

删除「有调用方」的键会被**编译期当场拦截**——union keyof 交集语义使调用点 TS2345（ADR-0002 勘误实验实证）。因此误删不可能静默入库：删错 → `npx tsc --noEmit` 红 → 还原该键。

## 待拍板题（grilling 输入）

1. **全删 vs 复核删**：39 键证据链同质（同一轮甄别），建议全删+编译期护栏兜底；逐键复核（39×3 文件人工过一遍）边际收益低。
2. **时机**：随 vc 列车（删除无运行时行为变化，非硬性窗口）或独立小批。
3. **弱孤 37 个是否同批处理**：`WIDE_PREFIXES` 族（setting_/songlist_）人工甄别后可能再产出死键第二批——同批做还是等甄别完另批。

## 实施口径

- 删除动作用 json 库（勿文本 sed，`build-speed-optimization` 纪律）；三语同步删；删后 `KNOWN_DEAD_KEYS` 数组同步清空（防腐自检「死键复活」随之退役该批条目）。
- 验证：`npx tsc --noEmit` 全绿（护栏）+ `npm run check:lang` 全绿 + 真机抽查 2-3 个原死键场景（设置页/下载页）无空白文案。
- 回滚：revert 单 commit。
