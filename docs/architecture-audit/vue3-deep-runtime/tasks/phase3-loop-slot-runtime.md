# Phase 3：LoopRegion、SlotRegion 与 ScopeFrame

> 状态：已完成 | 任务：9 | 净工时：34h  
> 方案：[../plans/04-loop-slot-regions.md](../plans/04-loop-slot-regions.md)

## 任务

- [x] **T3.1**: 实现不可变 ScopeFrame 与 generation 生命周期
  - **描述**：用显式 parentId/bindings/generation 表示 event/loop/slot 词法作用域，替代 Object.create 整份 RuntimeContext。
  - **产出物**：`packages/vario-core/src/scope/scope-frame.ts`、`packages/vario-core/src/scope/index.ts`、`packages/vario-core/__tests__/scope/scope-frame.test.ts`
  - **参考**：`packages/vario-core/src/runtime/loop-context-pool.ts`、RuntimeContext read/write Facade。
  - **复用**：现有 RuntimeContext `_get/_set` 外观、error hierarchy 和 session cleanup。
  - **验收**：frame 不 `Object.create(parentCtx)`；local chain lookup 正确；release 后不保留 parent RuntimeContext/Session；公开 pool API 有 shim。
  - **预估**：4h
  - **依赖**：T1.6

- [x] **T3.2**: 让 ExpressionPlan 按词法优先级解析 local binding
  - **描述**：实现 current local → parent local → state → capability 的固定顺序，并把 scope generation 纳入 memo。
  - **产出物**：`packages/vario-core/src/expression/plan-evaluator.ts`、`packages/vario-core/__tests__/expression/scope-precedence.test.ts`
  - **参考**：`packages/vario-core/src/expression/compiler.ts` 对 `$*` 的 fallback、现有 loop alias 回归。
  - **复用**：T1.5 ExpressionPlan deps、T1.6 result memo、T3.1 ScopeFrame。
  - **验收**：local > parent local > state；同名 alias/property 全正确；scope 不绕过 exact capability policy；async continuation 校验 generation。
  - **预估**：3h
  - **依赖**：T1.5、T3.1

- [x] **T3.3**: 编译 immutable LoopPlan 与 SlotPlan
  - **描述**：把 items/key/template/alias/slot props 在 prepare 阶段编译，删除 render 每项 clone/recursive mark 的需求。
  - **产出物**：`packages/vario-schema/src/compiler/prepare-loop.ts`、`packages/vario-schema/src/compiler/prepare-slot.ts`、`packages/vario-schema/__tests__/compiler/loop-slot-plan.test.ts`
  - **参考**：`packages/vario-vue/src/features/loop-handler.ts#markLoopSchema`、`children-resolver.ts#resolveSlots`
  - **复用**：PreparedNode、ExpressionPlan、ScopeFrame 和现有 loop/slot normalization。
  - **验收**：plan frozen；render 时每 item 的 schema clone=0、recursive mark=0；key/alias/slot diagnostic 含 source node/path。
  - **预估**：4h
  - **依赖**：T1.7、T3.1

- [x] **T3.4**: 实现稳定 LoopRegion 与 key diff
  - **描述**：按 regionId+stable key 管理 cell create/move/remove，结构更新前检查 key 与展开预算。
  - **产出物**：`packages/vario-vue/src/components/loop-region.ts`、`packages/vario-vue/__tests__/components/loop-region.test.ts`
  - **参考**：`packages/vario-vue/src/features/loop-handler.ts`
  - **复用**：Fragment、PreparedRenderer、LoopPlan 和 RuntimeBudget。
  - **验收**：reorder 不丢相同 key 的本地状态/ref；append/remove 只操作相关 cell；duplicate/null/object key typed diagnostic；index fallback 有警告。
  - **预估**：4h
  - **依赖**：T2.7、T3.2、T3.3

- [x] **T3.5**: 重写 LoopItemCell 为精确 item/scope 订阅
  - **描述**：cell props 只传 stable IDs/key/generation/version，按 item ChangeSet 更新，不捕获 siblings/Schema/旧 context。
  - **产出物**：`packages/vario-vue/src/components/loop-item-cell.ts`、`packages/vario-vue/__tests__/components/loop-item-cell.test.ts`
  - **参考**：`packages/vario-vue/src/features/loop-item-cell.ts`
  - **复用**：DynamicRegion token、T3.1 ScopeFrame、现有 cell 行为 fixture。
  - **验收**：1000 项改单项只 render 1 cell+必要祖先；其他 999 为 0；unmount/release 后 closure 不保留 parent/siblings。
  - **预估**：4h
  - **依赖**：T3.4

- [x] **T3.6**: 覆盖 nested loop 的 alias、model、event 与 NodeContext
  - **描述**：验证两/三层 loop 增删改移、同名 scope、`$parent/$siblings`、model 写回和 async event。
  - **产出物**：`packages/vario-vue/__tests__/prepared/nested-loop.test.ts`、`packages/vario-vue/__tests__/prepared/loop-model-event.test.ts`
  - **参考**：`todo-loop.test.ts`、`model-path-comprehensive.test.ts`、`node-context.test.ts`
  - **复用**：现有公开 alias/model/event 语法、T0.6 fixture、T3.2 scope precedence。
  - **验收**：两/三层增删改移文本与写回全正确；scope 不串；NodeContext 从 flat index/cell table 派生且不复制 siblings 数组。
  - **预估**：4h
  - **依赖**：T3.5

- [x] **T3.7**: 实现 SlotRegion 与 slot ScopeFrame
  - **描述**：按 SlotPlan 建稳定 slot function/consumer region，slot props 用 ScopeFrame 传播精确版本。
  - **产出物**：`packages/vario-vue/src/components/slot-region.ts`、`packages/vario-vue/__tests__/components/slot-region.test.ts`
  - **参考**：`packages/vario-vue/src/features/children-resolver.ts#resolveSlots`
  - **复用**：T3.1 ScopeFrame、T3.3 SlotPlan、PreparedRenderer。
  - **验收**：slot function identity 稳定；prop 改变只更新消费 region；named/default/fallback slot 顺序与 legacy fixture 一致。
  - **预估**：4h
  - **依赖**：T2.7、T3.2、T3.3

- [x] **T3.8**: 定义 VirtualListAdapter 与 reference adapter
  - **描述**：提供 optional host viewport/overscan/anchor contract 和测试 reference 实现，不绑定具体 UI 库。
  - **产出物**：`packages/vario-vue/src/runtime/virtual-list-adapter.ts`、`packages/vario-vue/__tests__/fixtures/reference-virtual-adapter.ts`、`packages/vario-vue/__tests__/prepared/virtual-list.test.ts`
  - **参考**：T3.4 LoopRegion、专项 `maxExpandedNodes` 契约。
  - **复用**：宿主传入 key/range/overscan 的现有 options 扩展方式。
  - **验收**：adapter 可选；未配置在预算内保持全量语义、超预算明确失败；reference 1000 项 DOM≤200，focus/anchor/a11y 通过。
  - **预估**：4h
  - **依赖**：T3.4

- [x] **T3.9**: 执行 loop/slot 性能、正确性与 heap 门禁
  - **描述**：将 1000 行改单项、nested scope、virtual DOM、展开预算和 20 轮 mount/unmount 纳入浏览器门禁。
  - **产出物**：`packages/vario-vue/__tests__/browser/loop-slot-performance.test.ts`、`benchmarks/vue-depth/baseline/loop-slot.json`
  - **参考**：总门禁 PERF-A2/T5/T6/D1、VUE-6、MEM-1/2 与专项 AC-11～AC-13。
  - **复用**：T0 browser runner、T3.5/T3.7 counters、T3.8 reference adapter。
  - **验收**：1000 单项 1 cell 且 p95≤8ms；DOM≤200；nested/slot 正确；超限前失败；heap 无持续增长；任何 correctness 失败使性能门禁失败。
  - **预估**：3h
  - **依赖**：T3.5、T3.6、T3.7、T3.8

## 阶段出口

- [x] loop/slot 不 clone 或递归标记模板 Schema。
- [x] 单项更新、嵌套 scope、虚拟化、预算与 retained heap 同时通过。
- [x] 尚未授权 SSR 或长期多页面生产。

