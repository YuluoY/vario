# 子方案 01：基线、深度与正确性契约

> 状态：待实施 | 阶段：Phase 0  
> 关联：[总方案](./README.md) · [任务](../tasks/phase0-baseline-and-contracts.md)

## 目标

在修改更新模型前，先建立可复现事实基线并修复会让基准失真的错误：静默截断、lifecycle 重挂、loop/scope 语义、连续写吞更新和深路径失败通知。Phase 0 的出口不是“性能达产”，而是后续重构拥有可信比较基线。

## 指标维度

| 维度 | 固定场景 | 必须同时记录 |
|---|---|---|
| `D` | 1、20、50、100、101、200、500、1000 | 最深节点、异常类型、mount/update/unmount |
| `N` | 1、100、500、1000、5000 | renderer/region/parent-index 次数、DOM 数 |
| `S` | 100、1000、5000、10000、20000 | state traversal 次数、update p50/p95 |
| `R` | 10、100、500、1000 与 2 或 3 层嵌套 | cell render、scope、DOM、展开预算 |
| `M` | 同 tick 1、10、100 次写 | ChangeSet、Vue commit、最终 DOM |
| 组件边界 | inline/forced boundary/real component | 实例、render、栈失败深度 |

场景生成器必须 deterministic；同 seed 的 Schema、state、items 和 expected DOM 深等价。性能数据无正确性断言时无效。

## Runner 协议

1. 使用 production Vue 与 production Vario bundle。
2. 每场景独立重置 DOM、Session、cache 和计数器。
3. 时间场景不在采样内强制 GC；内存场景使用 CDP `collectGarbage`。
4. 20 次预热、50 次正式样本、3 个独立进程，以三轮 p95 的中位数判定。
5. JSON 必含 runnerId、CPU、OS、Node、Chrome、Vue、commit、worktree 状态、mode 和 timestamp。
6. 分开报告 prepare、VNode、Vue patch/commit、下一帧 paint；不得把 `renderer.render()` 当完整 Vue 更新。
7. 保存每个样本，不只保存汇总值；失败样本保留 error code、node path 和实际 DOM 深度。

## 深度与错误契约

| 情况 | 预期行为 |
|---|---|
| `D≤effectiveMaxDepth` | 完整 prepare/mount/update/unmount，最深节点可查询和验证 |
| Schema cycle | prepare 阶段 `CIRCULAR_REFERENCE`，不创建 VNode |
| `D>mountMaxDepth` | mount 前 `SCHEMA_DEPTH_EXCEEDED`，包含 actual/limit/path/nodeId |
| compiler 压测 10,000 层 | 显式栈完成扫描或按 policy 主动中止，不出现 RangeError |
| descendant Vue error | 固定 ErrorBoundary 捕获，进入 `error/onError/DiagnosticSink` |
| 内部 RangeError | 视为实现缺陷并抛出，绝不转换为 `null` child |
| path 超限 | typed write error，state/DOM/ChangeSet 均不改变 |

`prepareMaxDepth` 与 `mountMaxDepth` 是两个概念。前者验证算法和输入安全，后者控制 Vue/DOM 产品容量；默认 mount 上限 100，正常业务建议 50 以内。

## 正确性矩阵

| 特性 | 深度 | 必测动作 | 断言 |
|---|---:|---|---|
| text/props/cond/show | 1、20、50、100 | 初挂、叶更新、根 schema replace | DOM 与表达式结果 |
| model/path | 1、20、50、100 段 | 默认值、用户写回、失败 | state/DOM/ChangeSet |
| lifecycle | 20、100 | update、移除、重试 | hook 精确次数 |
| error | 20、100、101 | child setup/render/update throw | fallback 与 diagnostic |
| loop alias | 2、20 层外壳 | item/index/nested alias | 文本、事件、写回路径 |
| scoped slot | 2、20 层外壳 | slot props 改变 | 只更新消费节点且顺序正确 |
| public API | 全部 | typecheck/import/return | value/type/overload/字段 snapshot |

## 诊断/计数 Hook 约束

- 默认实现是 no-op，production 未启用时不分配事件对象。
- 内部 hook 不进入必需 public API；测试通过 engine/session option 注入。
- 计数对象至少覆盖 `prepareNode`、`indexWrite`、`legacyRenderNode`、`regionRender`、`loopCellRender`、`expressionEval`、`domCommit`。
- 不记录 state 值、表达式原文、event payload 或 token。
- hook 自身抛错必须被隔离，不能改变渲染结果。

## 实施顺序

```text
fixture/types
  ├─ operation counters
  ├─ browser runner
  ├─ depth/error tests
  └─ loop/slot/model tests
       → explicit diagnostics and no-swallow fix
       → reproducible legacy/API baseline
```

## Phase 0 出口

- D≤100 全链路正确；D>100 是 mount 前 typed failure。
- child/slot/loop 中不存在 catch 后静默丢节点的路径。
- loop alias、model path、连续写和 lifecycle baseline 有真实 DOM/state 断言。
- benchmark JSON 可在相同 commit/environment 重放。
- public API baseline 覆盖根/子出口、value/type、overload 和 `UseVarioResult`。
- 尚未移除 deep watch，也不宣称局部更新达成。

## 回滚

Phase 0 只允许新增测试、诊断和明确正确性修复。若错误行为已被历史业务依赖，保留显式 legacy compatibility flag 和迁移 diagnostic；不允许恢复静默截断或伪成功通知。
