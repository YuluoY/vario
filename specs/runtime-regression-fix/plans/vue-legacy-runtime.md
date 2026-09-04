# 子 plan B：@variojs/vue legacy 运行时

> 日期: 2026-09-03 | 作者: huyongle | 关联 spec: [../spec.md](../spec.md) | 总入口: [README.md](./README.md) | 依赖: [core-runtime.md](./core-runtime.md)

覆盖 spec FR-2（vue 部分）、FR-5、FR-6、FR-7、FR-8、FR-13。

## 模块/组件设计

### B1 runtimeMode 贯穿（`renderer.ts`、`composables/internal/use-vario-phases.ts`）
- **职责**: 渲染管线各模块拿到显式模式，不再用 session 是否存在推断。
- **设计**: `VueRendererOptions.runtimeMode?: RuntimeMode`（默认 `'legacy'`）；`VueRenderer` 保存并注入 `ExpressionEvaluator(mode)`、`EventHandler(evalFn, mode)`、`LifecycleWrapper`（经 `plugins/lifecycle.ts` 传入）；`initRenderer` 传 `resolvedRuntimeMode(options)`。
- **数据流**: `useVario(options)` → `runtimeMode` → `initRenderer` → renderer → features。

### B2 `VarioLegacyRoot`（新 `components/legacy-root.ts`、`composable.ts:239-267`、`use-vario-phases.ts:createRenderWithErrorBoundary`）
- **职责**: 在组件 render 函数内执行 legacy 渲染；承载错误边界；宿主只渲染一个稳定组件 vnode。
- **对外接口**:

```ts
export const VarioLegacyRoot = defineComponent({
  name: 'VarioLegacyRoot',
  props: { renderFn: Function, revision: Number },
  setup(props) { return () => (props.renderFn as () => VNode | null)() }
})
```

- **composable 变更**: legacy 分支 `publicVnode = { get value() { return h(VarioLegacyRoot, { key: rootKey, renderFn, revision: revision.value }) } }`；scheduler `setRenderFn(() => { revision.value += 1 })`；`retry()`/`patchNode` 同样递增 revision；无实例（`!instance`）时保留 `render()` 直出到 `vnodeRef`。
- **错误边界**: `createRenderWithErrorBoundary` 改为返回 `VNode | null`（内部仍维护 `errorRef`），由 `renderFn` 调用；`errorBoundary.fallback` 结果同样在 render 函数内返回。
- **refs owner**: `renderer.instance` 改为惰性 `getCurrentInstance()`（在 `VarioLegacyRoot` render 内即该组件实例）；`ComponentResolver` 的 appContext 仍取宿主 `instance.appContext`（同一 app）。
- **回滚开关**: 内部常量 `LEGACY_HOST_MODE`，`'inline'` 走旧 getter 路径（仅应急）。

### B3 ExpressionEvaluator / provide-inject / loop-handler 分流（`features/expression-evaluator.ts`、`features/provide-inject.ts`、`features/loop-handler.ts`）
- **设计**: `evaluateExpr`：`mode === 'legacy' ? evaluate(finalExpr, ctx) : evaluateExpressionPlan(...)`；`provide-inject.ts:67-75` 同理（通过传入的 evaluator 或 mode 参数）；`loop-handler` 只用 `evaluateExpr`，自动继承。
- **白名单错误告警**: `evaluateExpr` catch 中若为 `ExpressionError` 且 code 为 `EXPRESSION_VALIDATION_ERROR`（白名单/AST），按 `expr` 去重 `console.warn('[Vario] expression rejected:', expr, message)` 一次。

### B4 作用域插槽与事件缓存判定（`features/children-resolver.ts`、`features/event-handler.ts`、`renderer.ts:applyVNodeDecorators`）
- **children-resolver**: `slotCtx = createScopeContext(ctx, { [n]: scope })`；删除 `q` WeakMap 缓存与 `hit/s` 逻辑，每次 render 重建插槽函数（与 HEAD 一致）；`resolveTextContent` 不变。
- **event-handler**: `isInScopedSlot = isScopeContext(ctx)`；`isInLoop` 保持 `'$item' in ctx || '$index' in ctx`（scope ctx 不再含这两个键）。
- **renderer.attachRef**: `inLoop` 判定不变（scope ctx 修复后自然正确）。

### B5 事件 frame 按 id 释放（`runtime/page-session.ts`、`features/event-handler.ts`）
- **PageSession 新增**:

```ts
createEventFrame(bindings): ScopeFrame   // parent = this.currentFrame()（渲染帧或 null），frames.set(frame.id, frame)，不入 frameStack
releaseFrame(frame): void                // releaseScopeFrame(this.frames, frame)
```

- **event-handler**: `eventFrame = session?.createEventFrame({ $event: e })`；`finally` 中 `session?.releaseFrame(eventFrame)`；删除 `parentFrame` 与 `SCOPE_STALE_GENERATION` 检查（`event-handler.ts:494-503`）；表达式求值时传 `frame: eventFrame`（prepared）——legacy 走 `evaluate` 不需要。
- **legacy 降级**: legacy 模式事件不创建 frame（`$event` 直接挂 `eventCtx`，现状已有），避免无意义的 frames 写入。

### B6 dispose 语义（`adapter.ts`、`runtime/page-session.ts:243-281`、`composable.ts:292-310`）
- **adapter.release()**: `held = null` 后直接 return，删除逐 key `delete` 循环。
- **PageSession.dispose()**: 删除 `delete methods[key]` 循环；保留 `clearCache(ctx)`、`releaseVueAdapter(ctx)`。
- **composable.dispose()**: 删除清空 `reactiveState` 的循环。
- **disposed 写入**: 依赖子 plan A 的 `SESSION_DISPOSED_WRITE`（不抛）。

### B7 legacy 去开销（`composable.ts:239-249`、`runtime/page-session.ts:94,108-112`、`renderer.ts:227-241`、`use-vario-phases.ts:287-310`）
- **prepareView**: legacy 分支不再调用 `prepareView`（`view = null`），`PageSession` 在 `view === null` 时不建 `bridge`，`store.subscribe` 回调仅 `memo.bumpAll`（memo 在 legacy 不被读取，可进一步跳过）。
- **深度扫描**: `renderer.render` 的 `scanSchemaIterative` 结果缓存于 `WeakMap<SchemaNode, ScanResult>`，`patchNode` 时 `renderer.invalidateScan(root)`。
- **生产 flushPending**: 无 `onTrigger` 路径时改为"按 `recordChange` 已失效 + `invalidateCache` 根键一次"，避免每次 `_set` 都 `invalidateTopLevel` 全量（保留 `forceInvalidateAll` 语义给确实无法采集的场景）。
- **watch(schemaRef)**: 保持 `deep: false`，在文档标注（FR-16）。

## 数据模型

N/A。

## API 契约

- `UseVarioResult.vnode.value`：有实例时为 `VarioLegacyRoot` 组件 vnode（原为根元素 vnode）。
- `PageSession.createEventFrame/releaseFrame`：见 README。

## 测试策略

| 用例文件 | 覆盖 |
|---------|------|
| `__tests__/correctness/reactive-mutation.test.ts` | AC-2 全部场景（含 10ms 节奏连点） |
| `__tests__/correctness/directive-lifecycle.test.ts` | AC-6：hook 序列、无 `withDirectives` 警告、单次 render 计数（用 `emitPerformance('legacyRenderNode')` 计数或 spy `renderer.render`） |
| `__tests__/correctness/slot-scope.test.ts` | AC-4：循环内/外作用域插槽、`ref` 非数组 |
| `__tests__/correctness/shared-state-dispose.test.ts` | AC-7：v-if 卸载后共享对象不变、可重挂载、异步回写不抛 |
| `__tests__/correctness/event-session.test.ts` | 事件 20ms 超时会话结束后 v-model 写回、`_set` 正常；两个交叠异步事件后 `frames.size` 归零 |
| `__tests__/runtime/page-session.test.ts` 扩展 | `createEventFrame/releaseFrame` 语义 |
| `__tests__/comprehensive-perf-report.test.ts` | 前后对比（Phase 4） |

## 回滚方案

B2 以 `LEGACY_HOST_MODE` 开关回退；其余按文件 revert。
