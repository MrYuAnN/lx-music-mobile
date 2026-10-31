# Backlog（排期项单源）

- [ ] **AGP 10 升级前迁移**（2026-10-30 RN 0.88 批审查 S-e 落账）：`android.builtInKotlin=false` + `android.newDsl=false` 两 opt-out 是 AGP 10.x 移除的临时旗标（android/gradle.properties 注释自明期限）；AGP 10 发布升级前须完成 built-in Kotlin 与 new DSL 迁移并移除两行，防强制切换抓盲。
- [ ] **scroll.ts 事件负载 mutation 改造**（同批审查 S-d 挂账）：`src/utils/scroll.ts` 接力滚动依赖就地改写 NativeScrollEvent.contentOffset（RN 0.88 起类型层 Readonly=契约信号）；后续改 `lx_scrollNextParams` 存 `{ y: number }` 结构快照，消除 RN 未来冻结/复用事件对象即静默破坏接力滚动的隐患。
- [ ] **维护批清理**（同批审查 S-b/S-c）：scroll.ts:105 冗余条件行（无条件赋值完全覆盖条件分支，考证原 clamp 意图后二选一）；Button.tsx 死 props `onChangeText`/`onClearText`（零消费零调用方）。
