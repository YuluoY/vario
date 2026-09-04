# 子 plan A：@variojs/core 契约层

> 日期: 2026-09-03 | 作者: huyongle | 关联 spec: [../spec.md](../spec.md) | 总入口: [README.md](./README.md)

覆盖 spec FR-1、FR-2（memo 部分）、FR-3、FR-4、FR-9、FR-10、FR-14。全局架构与跨 slice 决策见 README，此处只写本 slice 的模块设计。

## 模块/组件设计

### A1 ExecutionSession 生命周期（`vm/execution-session.ts`、`vm/executor.ts`、`vm/handlers/loop.ts`）
- **职责**: 一次最外层 `execute()` 对应一个会话；会话随 `execute` 结束解绑；嵌套 `runChild` 与 loop 迭代共享同一会话。
- **对外接口**:

```ts
export class ExecutionSession {
  active = true            // 新增：execute 退出后置 false
  dispose(): void          // clearTimer + active=false
}
export function unbindExecutionSession(ctx: object): void   // sessions.delete(ctx)
export function getExecutionSession(ctx): ExecutionSession | undefined  // 只返回 active 且未 cancelled 的会话；否则顺手 unbind
```

- **`execute()` 变更**（`executor.ts:56-79`）:
  - `existing` 分支条件改为 `existing && existing.active && !existing.cancelled`，否则 `unbindExecutionSession(ctx)` 后新建。
  - `finally { session.dispose(); unbindExecutionSession(ctx) }`。
- **loop 共享**（`handlers/loop.ts:80-87, 112-119`）: 每次迭代 `bindExecutionSession(loopCtx, session)`，`finally` 中 `unbindExecutionSession(loopCtx)` 再 `releaseLoopContext`。
- **`assertSessionCanWrite`**（`execution-session.ts:161-167`）: 仅当 `getExecutionSession(ctx)` 返回活跃会话时 `throwIfCancelled`。
- **数据流**: `execute(actions, ctx)` → 新建/复用会话 → `runActions` → `finally` 解绑 → 后续 `_set` 不再命中旧会话。

### A2 特殊变量表达式不缓存（`expression/evaluate.ts`、`expression/plan-evaluator.ts`、`runtime/proxy.ts`）
- **职责**: `$event/$self/$parent/$siblings/$children` 相关表达式每次求值；赋值这些变量时失效旧缓存。
- **设计**:
  - `evaluate.ts:21` `LEXICAL_ROOTS` 增加 `$event/$self/$parent/$siblings/$children`；`hasLexicalRoot` 正则同步。
  - `plan-compiler.ts:39` 已把 `$` 前缀归 `dynamicDeps`（不入 memo），保持；但 `$variables/$datasources/$functions/$utils` 应从 `dynamicDeps` 排除并作为 `stateDeps` 参与版本（命名空间失效走 `invalidateCache(name, ctx)` → 需同时 `memo.bump(name)`，由 vue 侧 `onNamespacesChange` 处理，见子 plan C）。
  - `proxy.ts:57-64`: allowedSpecialVars 赋值成功后 `invalidateCache(propName, proxy)`。
- **边界**: `cache.ts` 的 `isCacheValid` 保持 TTL 语义，不恢复 `_get(dep) !== undefined` 校验（后者在 adapter 下会误判 `$` 变量）。

### A3 ResultMemo 前缀失效（`expression/result-memo.ts`、`expression/plan-evaluator.ts`）
- **职责**: memo 版本对路径前缀/祖先双向传播；对象/数组/undefined 结果不入 memo。
- **对外接口**:

```ts
class ResultMemo {
  private readonly knownDeps = new Set<string>()
  bump(path: string): void   // 对 knownDeps 中 matchPath(dep, path) || matchPath(path, dep) 的 dep 递增版本，并对 path 自身递增
  store(planId, deps, value, scopeGeneration): void  // deps 登记到 knownDeps；value 为对象/数组/undefined 时直接 return
}
```

- **复杂度**: `bump` O(|knownDeps|)，`knownDeps` 上限跟随 `maxSize`（2000）；超出时 `clear()`（已有）。
- **依赖**: `matchPath`（`runtime/path.ts`）。

### A4 白名单恢复（`expression/policy.ts`、`expression/whitelist.ts`、`expression/evaluator.ts`）
- **职责**: 恢复 HEAD 可用面，不扩大攻击面。
- **设计**:
  - `policy.ts`: `WHITELISTED_GLOBALS` 加 `JSON`；新增 `isWhitelistedGlobalStaticCall(funcName)`：`root ∈ WHITELISTED_GLOBALS && !FORBIDDEN_OBJECT_METHODS.has(method)`；`WHITELISTED_FUNCTIONS` 加回 `Math.random`（仍在 `IMPURE_FUNCTIONS`）。
  - `whitelist.ts:122-138`: `allowed = isExactWhitelistedFunction || isWhitelistedGlobalStaticCall || SAFE_ARRAY_METHODS.has(prop) || capabilityRoot`；`reverse/sort` 单独判断：`member.object.type === 'CallExpression'` 时放行，否则报 `Function "x.reverse" mutates state; use slice().reverse()`。
  - `evaluator.ts:539-542`: `isWhitelisted` 加 `isWhitelistedGlobalStaticCall(funcName)`；数组分支 `SAFE_ARRAY_METHODS` 之外的 `reverse/sort` 仅当 `member.object.type === 'CallExpression'`。
- **P2 可选**（不阻塞）: `SAFE_STRING_METHODS`/`SAFE_NUMBER_METHODS`，运行时按 `typeof obj` 校验。

### A5 loop/scope ctx 原语与词法写入（`runtime/loop-context-pool.ts` → 拆出 `runtime/forwarding-context.ts`、`runtime/path-policy.ts`、`runtime/create-context.ts`）
- **职责**: 提供不挂原型链的转发 ctx（loop 与 scope 共用），维护 `loopParents`，支持 `$item.*`/别名子路径写入。
- **对外接口**:

```ts
// forwarding-context.ts（新）
export function createForwardingContext(parentCtx, locals): RuntimeContext        // 抽自 loop-context-pool.ts:80-99
export function getParentContext(ctx): RuntimeContext | undefined                  // loopParents/scopeParents 查询
// loop-context-pool.ts
export function createLoopContext(parentCtx, item, index, options?: { itemsPath?: string; itemKey?: string; indexKey?: string }): RuntimeContext
export function releaseLoopContext(loopCtx): void   // 只删 loopTargets/loopParents 登记，不清空 locals
// scope-context.ts（新）
export function createScopeContext(parentCtx, bindings): RuntimeContext
export function isScopeContext(ctx): boolean
```

- **词法写入**（`createLoopContext` 包装 `_set`）: 首段为 `$item` 或 `itemKey` → `setPathValue(item, rest)`；若 `options.itemsPath` 存在则 `recordChange(parentCtx, \`${itemsPath}.${index}.${rest}\`)` + `invalidateCache(同路径, parentCtx)`，否则 `invalidateCache(itemsPath ?? '', parentCtx)` 兜底并 emit 诊断；`$index`/`indexKey` 写入抛 `PathWriteError`。
- **`path-policy.isSystemPath`**: 仅当 `root ∈ SYSTEM_ROOTS` 且 root 是 `$methods/$emit/$exprOptions/_get/_set/$self/$parent/$siblings/$children/$event` 时判系统路径；`$item/$index/$variables/...` 的子路径不在此拦截（由 ctx 层决定）。`parsePath` 遇到 `[]` 抛 `PATH_UNRESOLVED_INDEX`。
- **`getPageSessionForContext`/`getExecutionSession` 回落**: 两处在原型链查找失败后调用 `getParentContext(ctx)` 继续查找（vue 侧 `page-session.ts:38-46` 同步）。
- **`path.ts` 读取**（`ownGet`，133-146）: `isForbiddenSegment` → undefined；否则 `segment in value ? Reflect.get(value, segment) : undefined`（对 `Map/Set` 等保留现有分支）。

### A6 emit / batch / paused（`vm/handlers/emit.ts`、`vm/handlers/batch.ts`、`vm/executor.ts`）
- **emit**: 未提供 `data` 时 payload `undefined`（恢复 HEAD）。
- **batch**: 用 `session.beginJournal()` 扩展为记录 `(path, oldValue)`；`_set` 在有 journal 时先 `journal.record(path, ctx._get(path))`；失败时逆序 `_set(path, old, { skipCallback: true, bypassSession: true })`，并在 `endChangeTransaction` 之前完成回滚；超时/abort 场景抛 `BatchError` 而非被 `assertSessionCanWrite` 抢先抛 `ACTION_TIMEOUT`。
- **paused**: `execute()` 命中 `isOwnerPaused(ctx)` 时 emit `{ name: 'action-skip', diagnostic: { code: 'SESSION_PAUSED' } }`。
- **runtime-session**: `RuntimeSession.dispose()` 不变；`create-context.ts:_set` / `proxy.ts:set` 在 `isContextDisposed` 时 emit `SESSION_DISPOSED_WRITE` 并返回（不抛）。

## 数据模型

N/A（仅 `ErrorCodes` 新增三项，见 README）。

## API 契约

见 README "API 契约"。`createLoopContext` 第四参数可选，旧调用不受影响。

## 测试策略

| 用例文件 | 覆盖 |
|---------|------|
| `__tests__/regression/execution-session.test.ts` | 两次 `execute` 独立 deadline/steps；execute 后 `getExecutionSession` 为 undefined；loop 迭代共享 `executionId` |
| `__tests__/regression/expression-cache-special-vars.test.ts` | `$event/$self` 两次求值不同值；`$variables.x` 可缓存且 `invalidateCache('$variables')` 失效 |
| `__tests__/regression/result-memo-prefix.test.ts` | `bump('items')` 失效 `items.length`；`bump('items.0.name')` 失效 `items.0`；对象结果不入 memo |
| `__tests__/regression/whitelist-parity.test.ts` | AC-5 全部表达式 + `Object.assign`/`eval` 拒绝 |
| `__tests__/regression/lexical-write.test.ts` | `_set('$item.done')` 写回 + 变更路径；`$index` 写入抛错；`users[].name` 抛 `PATH_UNRESOLVED_INDEX` |
| 改写 `__tests__/vm/executor.test.ts:709-716`、`__tests__/vm/handlers/emit.test.ts:29-36`、`__tests__/runtime/loop-context-pool.test.ts` | 纠正固化断言 |

## 回滚方案

按文件粒度 revert；A4 可独立 revert。
