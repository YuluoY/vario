# 子方案 02：PreparedView、ExpressionPlan 与版本化依赖

> 状态：待实施 | 阶段：Phase 1  
> 关联：[总方案](./README.md) · [任务](../tasks/phase1-prepared-and-dependencies.md)

## 目标

把 Schema 结构解释从 Vue render 热路径移到 revision 驱动的 prepare 阶段，并建立可靠的表达式依赖版本。Phase 1 只启用 shadow prepare，不负责真正输出 prepared DOM。

## 类型契约

```typescript
type NodeId = string
type RegionId = string
type PlanId = string

interface PreparedView {
  readonly id: string
  readonly revision: number | string
  readonly rootNodeId: NodeId
  readonly nodes: ReadonlyMap<NodeId, PreparedNode>
  readonly regions: ReadonlyMap<RegionId, PreparedRegion>
  readonly diagnostics: readonly VarioDiagnostic[]
  readonly stats: PreparedStats
}

interface PreparedNode {
  readonly id: NodeId
  readonly parentId: NodeId | null
  readonly childrenIds: readonly NodeId[]
  readonly depth: number
  readonly schemaPath: string
  readonly regionId: RegionId
  readonly flags: number
  readonly staticAttrs?: Readonly<Record<string, unknown>>
  readonly dynamicPlans: readonly PlanId[]
}

interface ExpressionPlan {
  readonly id: PlanId
  readonly ast: unknown
  readonly stateDeps: readonly PathToken[]
  readonly localDeps: readonly string[]
  readonly dependencyMode: 'exact' | 'prefix' | 'dynamic'
  readonly pure: boolean
  readonly estimatedCost: number
  readonly policyFingerprint: string
}
```

`PreparedNode` 不持有可变原始 Schema 引用。需要 diagnostic 或画布定位时保存 stable ID 与路径；开发态可在独立 WeakMap 中关联源对象，但不得进入跨 revision runtime plan。

## 迭代 prepare 算法

```text
workStack = [{ source: root, parentId: null, depth: 0, path: 'root' }]
while workStack not empty:
  pop item
  check cycle/depth/node budget
  allocate stable nodeId
  compile feature flags and plans
  append parent/children/index once
  push children in reverse order to preserve document order
finalize maximal static regions and diagnostics
freeze result
```

硬约束：

- 对每个源节点访问一次；parent/index 写入目标 `≤3N`。
- children 顺序与源 Schema 一致。
- cycle 用 identity visited set 检测；duplicate stable ID 单独诊断。
- 预算在分配下一节点前检查，失败时不发布半成品 PreparedView。
- path 使用 token/parent link 派生，避免每层复制完整字符串；diagnostic 时再物化显示路径。

## Region 分类

| 分类 | 条件 | 输出 |
|---|---|---|
| StaticRegion | 无 state/local/event/slot/runtime 依赖，无副作用 Vue feature | 最大连续静态骨架 |
| DynamicRegion | text/props/cond/show/model/动态 component 等表达式依赖 | stable regionId + dependency tokens |
| LoopRegion | loop plan、item key、template region | 单独 region，运行时维护 cells |
| SlotRegion | scoped/default slot plan | 单独 scope consumer region |
| SemanticBoundary | lifecycle/error/provide/ref/directive/Teleport/KeepAlive/Transition/plugin hook | 固定 Vue boundary，不得静态折叠 |
| ConservativeRegion | 动态 key、未知 capability 或无法精确提取依赖 | 显式 prefix/all token，并发出可观测原因 |

分类必须保守。旧 `countDescendants >= 5` 可以保留为 baseline 对比，但不再决定新组件边界。

## State 版本与 memo

```typescript
interface ChangeSet {
  readonly transactionId: string
  readonly changedPaths: readonly PathToken[]
  readonly versions: ReadonlyMap<string, number>
}

interface ResultMemoKey {
  readonly planId: PlanId
  readonly sessionId: string
  readonly scopeGeneration: number
  readonly dependencyVersions: readonly number[]
}
```

- 每个成功 write/mutate/batch 更新相关 exact/prefix version；失败不更新版本、不发布 ChangeSet。
- 同 tick/transaction 的多次写合并为一个 ChangeSet，最终版本单调递增。
- AST/ExpressionPlan 可在相同 grammar+policy 下跨 Session 共享；结果 memo 绝不跨 Session 共享。
- `null`、`undefined`、`false`、`0` 都是合法命中值，必须使用独立 miss sentinel。
- Plan cache 使用 `O(1)` LRU，不允许容量达到 100 时全清；99/100/101/500/2000 工作集均有门禁。
- local binding 进入 scopeGeneration/version，不能误当 StateStore path。

## Shadow prepare

`useVario` 继续由 legacy renderer 输出 DOM；shadow 只执行 prepare 并比较：

- node 顺序、ID、parent/children/index；
- static/dynamic feature classification；
- expression/action/model/loop/slot plan diagnostic；
- legacy query/stats 与 PreparedView 统计；
- compile error 是否能映射到现有 `error/onError`。

shadow 阶段不得执行 action、service、lifecycle 或用户事件，不允许产生第二次业务副作用。

## 模块布局

```text
packages/vario-types/src/prepared.ts
packages/vario-schema/src/compiler/
  traverse-iterative.ts
  prepare-index.ts
  prepare-node.ts
  prepare-view.ts
packages/vario-core/src/expression/
  plan.ts
  plan-compiler.ts
  plan-cache.ts
  result-memo.ts
packages/vario-vue/src/runtime/
  runtime-mode.ts
  legacy-prepared-adapter.ts
```

## 测试与出口

- 单元测试：10,000 深链、cycle、duplicate ID、预算边界、顺序、immutable plan。
- 单元测试：state/local/dynamic dependency、policy fingerprint、purity、cache 边界和值域。
- 集成测试：同一合法 fixture 的 legacy query/stats/diagnostic 与 shadow plan 一致。
- 性能计数：1000 节点 index 写 `≤3N`；render 热路径不重复 parse path/expression。
- public API：启用 shadow 不改变 `useVario` 调用、返回字段或 DOM。

Phase 1 通过前，prepared renderer 不进入默认输出路径，根 deep watch 保留。

## 回滚

关闭 shadow mode 即可停止 prepare；PreparedView 不写回 Schema/state。若某类 feature 尚不能编译，生成明确 unsupported diagnostic 并让 legacy 继续输出，不返回伪静态计划。

