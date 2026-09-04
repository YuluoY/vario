# 运行时回退修复 复盘

> 日期: 2026-09-03 | 关联: [verification-report.md](./verification-report.md)

## 一、为什么 838 个测试没拦住这些回退

修复前全量测试约 838 个且全绿，但 11 类回退全部穿过了它们。逐类归因后是四种结构性盲区：

1. **测试固化了错误行为**。最典型的是 `executor.test.ts` 把"超时后再 execute 抛 ACTION_TIMEOUT"写成断言（把会话泄漏当契约）、`emit.test.ts` 把"无 data 时 payload 回退 `$event`"写成断言。回退发生时，测试不是没跑到，而是跟着错误实现一起改写了预期——测试在"验证实现"而不是"验证契约"。
2. **时间维度的用例缺失**。ExecutionSession 泄漏只在"首次事件 5 秒后"显形；838 个用例几乎都在挂载后立刻断言，没有任何用例跨越超时窗口再操作。同理，"按 10ms 间隔连点三次"这种真实节奏（每个事件是独立宏任务）没有用例覆盖，一次性同步三连击测不出会话解绑问题。
3. **写入路径覆盖不对称**。用例大量走 `ctx._set`（库内路径），几乎不测"直接改 state"（`state.count++`、`state.list.push()`——文档明示支持的宿主路径）。KG-2 视图冻结恰好只出现在直接改 state + legacy 表达式缓存的组合上。
4. **跨模式断言缺位**。prepared 与 legacy 各自有用例，但"同一 schema 在两种模式下断言相同 DOM 与 hook 序列"（feature-parity）不存在，所以 prepared 的循环 `$item` 丢失、别名串行、生命周期 ctx 错位都能在 prepared 自己的用例里"合理地"通过（用例绕开了触发条件，如不用事件、不用别名）。

## 二、本次新增的防护网

- **回归测试类别化**：core `regression/`、vue `correctness/`、vue `prepared/` 共 25 个新文件，每类回退至少一个最小复现，先红后绿（AC-9）。
- **模式对偶断言**：`feature-parity.test.ts` 以同一 schema 双模式断言相同 DOM、相同 hook 序列，覆盖 model/event/ref/slot/teleport/transition/keepAlive/directive/provide-inject。
- **门禁测试**：legacy bridge 零调用（`legacy-bridge-isolation.test.ts`）、`__varioLiveLoopItemCells` 卸载归零、100 次挂载 engine 表归零、`regionRender ≤ 4` 局部性门禁（替代不稳定的计时门禁）。

## 三、CI 应增加的用例类别（建议）

1. **真实节奏事件**：事件间用 `setTimeout(≥10ms)` 分隔（宏任务边界），并在首个事件后等待超过默认 timeout（5s 太长，用 `execute(..., { timeout: 20 })` + 40ms 等待替代）再操作，断言后续 execute/`_set`/v-model 全部可用。本次 `event-session.test.ts` 已示范（`retry: 2` 对冲计时抖动）。
2. **直接改 state 类别**：每个渲染特性用例（插值/cond/show/props/model/loop）增加一条"直接改 state"变体（`state.x = …`、`state.list.push(...)`），与 `_set` 变体成对出现；prepared 下同时断言 `deepStateWatch` 开关两种配置的预期差异。
3. **双模式 parity 类别**：新增 schema 特性时，feature-parity 增加对应用例（两种模式 DOM 与 hook 序列必须一致），防止"prepared 修好了 legacy 又坏"的跷跷板。
4. **资源计数断言**：live cell 计数、PageSession 计数、engine sessions 计数在 mount/unmount 循环后归零——泄漏类回退只有计数器能稳定拦住。
5. **禁止把错误行为固化**：review 时对"断言某操作抛错/失效"的 diff 提高审查级别，要求引用规格条款；本仓库可在 CI 加一条 lint 规则扫描测试文件中的 `ACTION_TIMEOUT`/`Session disposed` 期望（白名单豁免规格指定的用例）。

## 四、过程教训

- **bridge.apply 的 id 去重是错误防御**：唯一调用方（PageSession store 订阅）不会重复投递，按 changeSet.id 去重反而破坏了"同 id 重放补 ctx"的合法用法。防御性代码必须有真实重复投递的证据才加。
- **prepared 路由里调 `scheduler.schedule()` 等于整树重建**：viewRevision 换 key 会让 token 精细更新完全失效（regionRender 400 vs 预期 ≤4）。token 驱动路径里任何"顺手再调度一次"都需要用局部性门禁验证。
- **祖先链失效要分层**：缓存失效层可以全祖先链（多失效只是多算）；bridge token 层必须精确（多 bump 就是多渲染）。`list.2 → list.length` 的级联只补 length，不补整个父路径。
