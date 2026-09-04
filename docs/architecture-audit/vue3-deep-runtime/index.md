# Vue 3 深层渲染与运行时局部化专项

> 日期：2026-08-31  
> 文档状态：设计已完成  
> 代码状态：已完成并全量通过（core 305 / schema 100 / vue 532 / cli 14 / consumer 10，lint 0 / tsc 全过）  
> 任务状态：51/51 勾选，`spec.md` 22 条 AC 全部勾选  
> 生产门禁：库级 G6 Production Core 已授予（PERF-D4 真实应用 RUM 与生产 SSR 集群为仓库外评审项）

本专项把 [Vario 中大型低代码核心架构审计](../index.md) 中与 `@variojs/vue`、N 层嵌套、局部更新、循环展开和多页面生命周期有关的结论，转换为可直接分工实施的规格、子方案和阶段任务。目录按 `uluo-doc-standards` 的标准方案组织；因用户明确要求产物进入 `docs/`，未采用默认的 `specs/` 路径。

## 当前结论

> 2026-09-01 更新：实施已完成并通过库级验收。以下"审计时点"的观察保留作为基线背景。

审计时点 `@variojs/vue` 在一次状态写入时执行 `deep watch(state) → root schedule → 递归重建整棵 VNode`，因此：

- 深度 `D` 增加时，会同时放大递归调用栈、路径字符串/数组、组件层级和 Vue patch 成本；当前实现会在环境相关深度处栈溢出，并可能把错误吞掉后返回残缺 UI。
- 状态图规模 `S` 增加时，即使 Schema 只有一个节点，无关状态更新也会因深监听而近似线性增长。
- 仅把节点改成 Vue 组件不能自动得到局部更新；当前边界 props 每轮会新建数组、对象和闭包，实测仍会让整条祖先链或整组兄弟组件重渲染。
- 嵌套循环的真实规模不是 Schema 节点数 `N`，而是展开实例数 `R`；多层循环可形成乘积增长。

所以，不能通过“调大最大深度”或“每个节点都组件化”达到生产目标。推荐实施顺序是：

```text
正确性与可复现基线
  → 迭代式 PreparedView + 版本化依赖
  → 稳定 VarioRoot + 动态区域
  → 移除根 deep watch
  → 稳定 LoopCell / SlotRegion / PageSession
  → SSR、内存、性能灰度门禁
```

## 文档导航

| 文档 | 用途 |
|---|---|
| [调研与证据报告](./research-report.md) | 解释当前调用链、复杂度、深度断点与 Vue 3 响应式事实 |
| [需求规格](./spec.md) | 定义边界、术语、功能需求、兼容约束和量化验收 |
| [执行方案总入口](./plans/README.md) | 汇总设计决策、模块依赖、迁移、测试和回滚 |
| [阶段任务总览](./tasks/README.md) | 给出依赖 DAG、阶段出口、工时与并行分工 |
| [验收报告](./verification-report.md) | AC 逐条对照；明确不授予生产准入 |
| [复盘](./retrospective.md) | 实现教训与后续 AI 项 |

## 默认容量政策

| 维度 | 默认政策 | 含义 |
|---|---|---|
| 正常生产嵌套 | `D ≤ 50` | 作为默认工程预算，不代表超过即一定失败 |
| 强制验证深度 | `D = 100` | 所有受支持特性必须通过 mount、update、unmount 与错误语义测试 |
| 超限输入 | mount 前 typed diagnostic | 不允许依赖 JavaScript `RangeError` 或静默截断 |
| 编译器压力 | `D = 10,000` | 只验证迭代式 prepare 不爆栈，不授权渲染 10,000 层 DOM |
| 循环展开 | `maxExpandedNodes` | 运行时按页面和区域预算限制乘积展开量 |

这些数值是可配置的安全默认值。最终生产准入仍以固定 runner、真实物料 fixture 和 [总体验收门禁](../acceptance-gates.md) 为准。

## 实施纪律

- `useVario(schema, options)` 以及当前全部 public API surface 和安全合法行为保持兼容。
- Prepared plan、组件定义和运行时服务可以 `markRaw` 或用浅层容器；业务 state、loop item 和用户可变数据不得因此失去 Vue 响应性。
- 在 ExpressionPlan 能记录依赖且 StateStore 能提供依赖版本之前，不删除现有 deep watch；先双轨校验，再切流。
- 只在动态、有状态或有语义生命周期的边界创建 Vue 组件；静态节点继续由区域内部直接生成 VNode。
- 专项验收与复盘见 [verification-report.md](./verification-report.md) 与 [retrospective.md](./retrospective.md)。库级生产准入已授予（2026-09-01）；prepared 保持显式 opt-in，默认 `legacy` 符合灰度纪律。

