# 子方案 04：LoopRegion、SlotRegion 与词法作用域

> 状态：待实施 | 阶段：Phase 3  
> 关联：[总方案](./README.md) · [任务](../tasks/phase3-loop-slot-runtime.md)

## 目标

消除 loop 每项 clone Schema、递归 mark、复制 path stack 和临时 RuntimeContext 的成本；修复 nested loop/slot 的词法别名优先级，并为大列表提供宿主可插拔的虚拟化契约。

## ScopeFrame

```typescript
interface ScopeFrame {
  readonly id: string
  readonly generation: number
  readonly parentId: string | null
  readonly bindings: Readonly<Record<string, unknown>>
}

interface ScopeResolver {
  getLocal(frameId: string, name: string): unknown
  getState(path: PathToken): unknown
}
```

查找顺序固定为：

```text
current local binding
→ parent local binding
→ PageSession state
→ registered pure capability
```

ScopeFrame 不使用 `Object.create(parentCtx)`，不复制 RuntimeContext 的系统方法。ExpressionPlan 在 compile 时区分 local/state dependency；同名时 local 优先。frame release 后不能从 pool 或 closure 保留 parent Session。

## LoopPlan 与 cell identity

```typescript
interface LoopPlan {
  readonly regionId: string
  readonly itemsPlanId: string
  readonly templateNodeId: string
  readonly itemAlias: string
  readonly indexAlias?: string
  readonly keyPlanId?: string
  readonly estimatedTemplateNodes: number
}

type LoopCellIdentity = `${regionId}:${stableItemKey}`
```

- 模板 PreparedNode 只编译一次，render 时每 item 的 Schema clone 和 recursive mark 次数必须为 0。
- `itemKey` 稳定且唯一时，reorder 只移动 cell，不销毁本地组件状态/ref。
- duplicate/null/object key 返回 typed diagnostic；无 key 时 index fallback 保持兼容并发开发告警。
- cell props 仅含 sessionId、regionId、itemKey、scopeId/generation、itemVersion 等稳定值。
- item 字段变化只递增对应 cell token；数组结构变化由 LoopRegion 做 key diff。

## 嵌套展开预算

在创建下一层 cell 前计算累计预算：

```text
projectedExpandedNodes
  = currentExpandedNodes
  + newCellCount × estimatedTemplateNodes
```

若嵌套层还含 loop，使用已知 length 的安全乘法并在溢出/超限前中止。预算对象至少含：

- `maxLoopItemsPerRegion`
- `maxExpandedNodesPerPage`
- `maxActiveLoopCells`
- `maxScopeDepth`

超限不能先构造对象再丢弃，也不能返回部分列表而无状态提示。可恢复策略只有：宿主虚拟化、显式分页/折叠、或 typed error/fallback。

## SlotRegion

- prepare 把 template/slot 转成 immutable SlotPlan，不在每次父 render 重新解析 children。
- slot function identity 在 scope 与 plan revision 未变时稳定。
- slot props 进入子 ScopeFrame；改变一个 prop 只更新实际读取它的消费 region。
- default children 与 named slot 的顺序、fallback 和 component slot contract 与 legacy fixture 一致。
- slot closure 只捕获 sessionId/planId/scopeId，不捕获整份 siblings、Schema 或旧 RuntimeContext。

## Model、Event、NodeContext 与 Ref

| 能力 | 新契约 |
|---|---|
| model | PathPlan 在 prepare 编译；item key 与数组 index 分离；reorder 后写回正确 item |
| event | 执行时创建轻量 EventFrame，读取当前 cell ScopeFrame；async continuation 保留 generation 校验 |
| `$parent/$siblings` | 从 PreparedView parent/children index 和 LoopRegion cell table 派生，不复制 siblings 数组 |
| ref | registry key 明确支持 single/collection；cell unmount/reorder 后无陈旧 ref |
| nested alias | current local > parent local > state，公开 `$item/$index` 与自定义 alias 同时有 fixture |

## VirtualListAdapter

```typescript
interface VirtualListAdapter {
  getVisibleRange(input: {
    itemCount: number
    overscan: number
    estimateSize?: number
  }): { start: number; end: number }
  onItemsChanged?(change: LoopChangeSet): void
  restoreAnchor?(key: string | number): void
}
```

- adapter 是 optional/additive host contract；未配置时保留兼容的全量语义，但超过预算应 diagnostic/拒绝，不无限分配。
- reference adapter 用于门禁，不绑定具体 UI 库。
- 1000 项默认 fixture 的 active DOM 目标 `≤200`，实际由 viewport+overscan 决定。
- 键盘焦点、屏幕阅读顺序、滚动 anchor、动态高度和 SSR fallback 必须有集成测试；虚拟化不能只优化 DOM 数。

## 测试矩阵

| 场景 | 断言 |
|---|---|
| 1000 项改单项 | 1 cell + 必要祖先 render，其他 999 为 0，p95≤8ms |
| append/remove/reorder | 只增删移动相关 key，其他 cell identity 保留 |
| duplicate key | mount 前/结构更新时 typed diagnostic |
| 2/3 层 nested loop | alias/index/model/event/node context 正确，不串 scope |
| scoped slot | slot identity 稳定，prop 只更新消费 region |
| budget overflow | 超限前中止，无超额 cell/DOM 和静默部分树 |
| virtual 1000 | DOM≤200，焦点/anchor/a11y fixture 通过 |
| 20 次 mount/unmount | frame/cell/closure 无 retained 增长斜率 |

## 回滚

prepared 页面若含尚未支持的 loop/slot feature，compile 阶段把整页标为 legacy-required；不在一个 loop 内混用两套 scope 模型。VirtualListAdapter 可单独关闭并回到预算允许内的全量 prepared loop；超过预算时不能通过回滚绕过安全限制。

