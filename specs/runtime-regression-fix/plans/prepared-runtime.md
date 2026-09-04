# 子 plan C：@variojs/vue prepared 运行时对齐

> 日期: 2026-09-03 | 作者: huyongle | 关联 spec: [../spec.md](../spec.md) | 总入口: [README.md](./README.md) | 依赖: [core-runtime.md](./core-runtime.md)

覆盖 spec FR-11、FR-12、FR-14（SSR/engine 部分）。prepared 仍为显式 opt-in，本 slice 只补齐本次审查发现的对齐缺口。

## 模块/组件设计

### C1 LoopItemCell ctx 生命周期（`components/loop-item-cell.ts`）
- **职责**: loopCtx 与 cell 组件同生命周期，事件闭包与延迟渲染的 `VarioNode` 子树都能读到 `$item`。
- **设计**: `setup` 内维护 `let loopCtx: RuntimeContext | null`；render 时若 `item/index` 变化则 `releaseLoopContext(old)` 后重建（`createLoopContext(parentCtx, item, index, { itemsPath: plan.itemsSource, itemKey, indexKey })`），否则复用并 `Object.assign` 刷新绑定；`onBeforeUnmount` 释放。`pushScope/pushLexical/popScope/popLexical` 仍只包住同步 render。
- **拦截器**: `prepared-renderer.ts:installRegionInterceptor` 的 `session.isLexical()` 判定改为"schema 是否为某 loop 模板的后代"（用 `view.nodes[id].parentId` 链在 `indexView` 时预计算 `loopDescendant: Set<nodeId>`），不依赖同步栈状态。

### C2 别名进入 localDeps（`vario-schema/src/compiler/prepare-view.ts`、`prepare-expression.ts`、`vario-core/src/expression/plan-compiler.ts`、`vario-types/src/prepared.ts`）
- **设计**:
  - `compileExpressionPlan(source, options?: { aliases?: readonly string[] })`：`localDeps` 判定为 `LOCAL_PREFIX ∪ aliases`；plan id 为 `${fingerprint}::${aliases.sort().join(',')}::${source}`；`ExpressionPlan.aliases` 记录。
  - `prepare-view.ts`：遍历 nodes 时维护祖先 loop 别名集合（`index.nodes` 已含 `parentId`，可自顶向下传递）；`compileExpressionSources(sources, expressions, aliases)`。
  - `compileLoopPlan` 的 `itemsPlanId/keyPlanId` 使用祖先别名（items 表达式本身不含自身别名）。
- **影响**: `preparedViewCache` 命中键含 plan id，属预期变化。

### C3 lifecycle ctx / instance / refs（`features/lifecycle-wrapper.ts`、`composable.ts:149-153`、`renderer.ts`）
- **lifecycle-wrapper**: `runtimeCtx = props.runtimeCtx ?? session?.currentLexical() ?? session?.ctx`（优先级反转）；`schema` 同理优先 `props.schema`。
- **instance**: prepared 分支 `initRenderer(instance, …)` 传真实实例（仅用于 appContext 与 ref owner；渲染宿主仍是 region 组件）；`refs.ts:149-153` owner 为空时改为 `getCurrentInstance()` 兜底。
- **组件解析**: `ComponentResolver` 在 `appComponents` 为空时于 render 内用 `getCurrentInstance()?.appContext.components` 兜底一次并缓存。

### C4 bridge 依赖匹配与直接改 state 路由（`runtime/state-bridge.ts`、`composables/internal/use-vario-phases.ts:setupWatchers`、`runtime/page-session.ts`）
- **state-bridge.apply**:
  - loop 匹配：用 `view.expressions.get(loop.itemsPlanId).stateDeps` 做双向前缀匹配，替代 `itemsSource` 原文比对；`items` 数组元素路径仍按下标定位 cell token。
  - 节点匹配：`node.expressionIds` 之外并入 `node.modelPlans[].path`。
  - `flushedIds` 的 microtask 清空改为在 `apply` 内按 `changeSet.id` 去重（同一 changeSet 内不重复 bump，跨 changeSet 允许）。
- **直接改 state**: prepared 下 `setupWatchers` 不再 `skipDeepStateWatch`，改为受 `options.runtimeBudget.deepStateWatch ?? true` 控制的 sync deep watch：回调用 `invalidationController.flushPending(path => recordChange(ctx, path, ctx._get(path)), () => { memo.nextGeneration(); bridge.bumpRoot() })`；state 包装从 `shallowReactive` 改回 `reactive`（同开关控制）。基准对比不达标时默认关闭并在文档标注"prepared 需通过 `_set` 写入"。
- **命名空间**: `onNamespacesChange` 回调在 `invalidateCache` 之外同步 `session.memo.bump(changedPath)`。
- **schema 替换**: `composable.ts:218-220` scheduler 回调改为：若 `schemaRef.value !== lastRoot` → `prepared = adaptLegacySchema(newRoot)`，`session.view = prepared; session.indexView(prepared); session.bridge = new VueStateBridge(prepared, budget)`，再 `viewRevision++`。

### C5 默认 virtualAdapter / SSR / engine（`runtime/page-session.ts:85-92,269`、`ssr/create-ssr-session.ts:39-60`、`runtime/virtual-list-adapter.ts`）
- **virtualAdapter**: 默认 `null`（全量渲染）；`LoopRegion` 在 `items.length > budget.maxLoopItems ?? 1000` 时 emit `LOOP_LARGE_LIST` 诊断（已有码）而不截断；reference adapter 仅在显式传入时使用。
- **SSR**: `renderSsrToString` 不 dispose 传入 ctx（改为 `session.deactivate()` 或由调用方 dispose）；`hydrateVarioApp` 复用同一 session 或对新 session 传入新建 ctx。
- **engine**: `engineId: options.engineId ?? 'default'`；`dispose()` 不再 `this.materials.clear()`；`RuntimeSession.dispose` 在 `engine.sessions.size === 0 && engineId !== 'default'` 时删除 engine 条目。

### C6 legacyRequired 判定补全（`vario-schema/src/compiler/prepare-view.ts`、`prepare-slot.ts`）
- 在 C1–C4 完成前，把"loop 模板含 `ref`"“作用域插槽含表达式”两类暂时标记 `LEGACY_REQUIRED`，完成后按 feature-parity 测试结果逐项解除。

## 数据模型

`ExpressionPlan.aliases?: readonly string[]`（见 README）。

## API 契约

- `compileExpressionPlan(source, { aliases })` 新增可选参数；旧调用不变。
- `UseVarioOptions.runtimeBudget.deepStateWatch?: boolean`（prepared 专用开关）。
- `PageSession.virtualAdapter` 默认 `null`（行为变更，CHANGELOG 标注）。

## 测试策略

| 用例文件 | 覆盖 |
|---------|------|
| `__tests__/prepared/loop-alias.test.ts` | `itemKey: 'user'` 各行独立；嵌套 loop 别名不串 |
| `__tests__/prepared/loop-event-ctx.test.ts` | 点击第 N 行方法收到对应 `$item/$index`；loop 模板含组件化子树时 `$item` 可用 |
| `__tests__/prepared/lifecycle-ctx.test.ts` | 循环内 `onMounted` 收到对应 `$item`；全局组件解析；`ref` 可用 |
| `__tests__/prepared/bridge-deps.test.ts` | `{{ list.slice(0,5) }}` 循环刷新；`model: 'form.name'` 写回刷新；直接改 state 刷新（开关开启时） |
| `__tests__/prepared/schema-replace.test.ts` | `computed` schema 替换后渲染新 view |
| `__tests__/prepared/virtual-default.test.ts` | 500 项全量渲染 + `LOOP_LARGE_LIST` 诊断；显式 reference adapter 仍截断 |
| `__tests__/ssr/*.test.ts` 扩展 | hydrate 后 `_set` 不抛 |
| `__tests__/runtime/page-session.test.ts` 扩展 | engine 表大小不随挂载增长；共享 engineId dispose 不清 materials |
| 改写 `__tests__/prepared/loop-model-event.test.ts:158-160` | 不再把 204 截断当预期 |
| `__tests__/prepared/no-root-watch.test.ts` | 去掉 `t < 8ms` 计时门禁，改为渲染计数断言 |

## 回滚方案

C4 的直接改 state 路由由 `deepStateWatch` 开关控制；其余按文件 revert。
