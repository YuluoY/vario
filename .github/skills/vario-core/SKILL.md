---
name: vario-core
description: >-
  Expert knowledge for @variojs/core — the framework-agnostic runtime engine of the Vario Schema-First UI system.
  Covers RuntimeContext (flat state, _get/_set, $emit, $methods), Expression Engine (parsing, AST validation,
  sandbox evaluation, whitelist functions, dependency tracking, compilation caching), Action VM (execute instruction
  pipeline: set/call/emit/if/loop/batch/navigate/log/push/pop/shift/unshift/splice), path utilities (parsePath,
  getPathValue, setPathValue, path caching), loop context pool (createLoopContext/releaseLoopContext, object reuse),
  Schema analysis tools (analyzeSchema, findNode, findNodes, findPathById, createQueryEngine, traverseSchema),
  security model (multi-layer sandbox, AST whitelist, property blacklist, nesting depth limits, timeout/maxSteps),
  error types (VarioError, ActionError, ExpressionError, ServiceError, BatchError), and performance optimizations
  (expression cache, path cache, loop context pool, WeakMap caching).
  Use this skill whenever the user is working with vario-core, RuntimeContext, expression evaluation, Action VM,
  writing or debugging VM instructions, path resolution, loop contexts, schema analysis/query, expression security,
  or any @variojs/core API. Also trigger when user mentions Vario runtime, expression sandbox, action execution,
  state management in Vario, or ctx._get/_set/$emit patterns.
---

# Vario-Core Skill

Expert guide for `@variojs/core` — the framework-agnostic runtime engine of Vario (Schema-First UI Behavior Runtime).

## Architecture

```
@variojs/types (shared types)
       ↓
@variojs/core
  ├── RuntimeContext  — flat state + system API (_get/_set/$emit/$methods)
  ├── Expression      — parse → validate AST → compile → evaluate (sandboxed)
  ├── Action VM       — execute instructions (set/call/if/loop/batch/...)
  ├── Path Utils      — parsePath, getPathValue, setPathValue, caching
  └── Schema Tools    — analyzeSchema, findNode, createQueryEngine
```

Source: `packages/vario-core/src/` — `runtime/` (context, path, loop-context-pool), `expression/` (parser, evaluator, whitelist, cache), `vm/` (executor + 13 handlers), `schema/` (analyzer, query-engine).

**Key constraint**: This package **never imports Vue or any framework** — it is pure JS/TS runtime logic.

---

## RuntimeContext

Central context object: flat state + system API. All renderers and VM instructions operate through it.

```typescript
import { createRuntimeContext } from '@variojs/core'

const ctx = createRuntimeContext(
  { count: 0, user: { name: 'John' } },
  {
    methods: {
      increment: (ctx) => ctx._set('count', ctx._get('count') + 1)
    },
    onEmit: (event, data) => { /* handle events */ },
    onStateChange: (path, value) => { /* react to changes */ }
  }
)
```

**State access is flat** — no `models.` prefix:
```typescript
ctx.count           // 0  (direct property access)
ctx._get('count')   // 0  (path-based, triggers dependency tracking)
ctx._set('count', 1)  // triggers onStateChange('count', 1)
ctx._set('user.name', 'Jane', { skipCallback: true })  // skip onStateChange
```

**System API conventions:**
| Prefix | Purpose | Examples |
|--------|---------|---------|
| `_` | Internal getters/setters | `_get(path)`, `_set(path, value, opts?)` |
| `$` | System endpoints | `$emit(event, data)`, `$methods`, `$exprOptions`, `$event`, `$item`, `$index` |

**Loop-injected fields:** `$item`, `$index` appear temporarily during loop execution.

---

## Expression Engine

Sandboxed expression evaluation: `{{ count > 10 }}`, `user?.name`, `Math.max(a, b)`.

**Pipeline:** source string → `parseExpression(str)` → AST → `validateAST(ast)` → compile → `evaluate(expr, ctx)`.

```typescript
import { evaluateExpression } from '@variojs/core'

evaluateExpression('count > 3 && user.age >= 18', ctx)  // boolean
evaluateExpression('items.length > 0 ? "yes" : "no"', ctx)  // string
```

**Supported syntax:**
- Property access: `count`, `user.name`, `items[0]`, `items[i]`
- Optional chaining: `user?.profile?.email`
- Binary ops: `+`, `-`, `*`, `/`, `%`, `===`, `!==`, `<`, `<=`, `>`, `>=`
- Logical: `&&`, `||`, `!`
- Ternary: `cond ? then : else`
- Function calls (whitelist only): `Array.isArray(x)`, `Math.max(a, b)`, `JSON.parse(s)`

**Whitelisted globals:** `String`, `Number`, `Boolean`, `Array`, `Object`, `Math`, `Date` (constructor only), `Array.isArray`, `JSON.parse/stringify`, `Math.*` methods, array readonly methods (`slice`, `map`, `filter`, `find`, `includes`, `indexOf`, `join`, `some`, `every`, `reduce`, `flat`, `flatMap`).

**Blocked:** `eval`, `Function`, `setTimeout`, `setInterval`, `window`, `global`, `require`, `import`, `__proto__`, `constructor`, `prototype`, assignment operators.

**Caching:** Compiled expressions cached per RuntimeContext (WeakMap, max 100). API: `getCachedExpression`, `invalidateCache`, `clearCache`, `getCacheStats`.

**Dependency tracking:** `extractDependencies(ast)` returns path array for fine-grained reactivity.

**Options** (`exprOptions`):
```typescript
{ maxSteps: 10000, timeout: 3000, maxNestingDepth: 50, allowGlobals: false }
```

---

## Action VM

Executes instruction sequences. Schema `events` are converted to Action arrays and passed to `execute()`.

```typescript
import { execute } from '@variojs/core'

await execute([
  { type: 'set', path: 'loading', value: true },
  { type: 'call', method: 'fetchData' },
  { type: 'set', path: 'loading', value: false }
], ctx, { timeout: 5000, maxSteps: 10000 })
```

### Instruction Set (13 types)

| Category | Type | Schema Example |
|----------|------|---------------|
| **Atomic** | `set` | `{ type: 'set', path: 'count', value: 10 }` |
| | `emit` | `{ type: 'emit', event: 'submit', data: { id: 1 } }` |
| | `navigate` | `{ type: 'navigate', to: '/home' }` |
| | `log` | `{ type: 'log', message: 'done', level: 'info' }` |
| **Control** | `call` | `{ type: 'call', method: 'save', params: { id: '{{ id }}' }, resultTo: 'lastId' }` |
| | `if` | `{ type: 'if', cond: 'count > 0', then: [...], else: [...] }` |
| | `loop` | `{ type: 'loop', var: 'item', in: '{{ items }}', body: [...] }` |
| | `batch` | `{ type: 'batch', actions: [...] }` |
| **Array** | `push` | `{ type: 'push', path: 'todos', value: { title: 'New' } }` |
| | `pop` | `{ type: 'pop', path: 'todos' }` |
| | `shift` | `{ type: 'shift', path: 'items' }` |
| | `unshift` | `{ type: 'unshift', path: 'items', value: 'first' }` |
| | `splice` | `{ type: 'splice', path: 'list', start: 0, deleteCount: 1 }` |

**String values are expression-evaluated:** `{ type: 'set', path: 'name', value: '{{ user.firstName }}' }` evaluates the expression first.

**`call` details:** `params` can be named object or array. `resultTo` writes return value to state path.

**Error handling:** Failed actions throw `ActionError` with action content + error code. `batch` collects all errors into `BatchError`.

---

## Path Utilities

```typescript
import { parsePath, getPathValue, setPathValue, parsePathCached } from '@variojs/core'

parsePath('user.name')        // ['user', 'name']
parsePath('items[0].title')   // ['items', 0, 'title']

const obj = { user: { name: 'John' }, list: [10, 20] }
getPathValue(obj, 'user.name')   // 'John'
getPathValue(obj, 'list.0')      // 10

setPathValue(obj, 'user.age', 30)  // auto-create intermediate objects
setPathValue(obj, 'deep.nested.val', 1, {
  createObject: () => ({}),
  createArray: () => []
})
```

**Path cache:** `parsePathCached` caches results (max 2000, LRU). `clearPathCache()` to reset.

**Helpers:** `getParentPath('a.b.c')` → `'a.b'`, `getLastSegment('a.b.c')` → `'c'`, `matchPath('user.*', 'user.name')` → true.

---

## Loop Context Pool

Object pool for loop iteration contexts — reduces GC pressure in large lists.

```typescript
import { createLoopContext, releaseLoopContext } from '@variojs/core'

for (const [index, item] of items.entries()) {
  const loopCtx = createLoopContext(ctx, item, index)
  // loopCtx.$item === item, loopCtx.$index === index
  await execute(body, loopCtx)
  releaseLoopContext(loopCtx)  // returns to pool, clears $item/$index
}
```

Pool max size: 100. Released contexts have dynamic fields cleaned before reuse.

---

## Schema Analysis Tools

Framework-agnostic schema inspection — used by renderers and query APIs.

```typescript
import { analyzeSchema, findNode, findNodes, findPathById, createQueryEngine } from '@variojs/core'

const result = analyzeSchema(schema)
// result.stats: { nodeCount, maxDepth }
// result.index: { idMap: Map<id, path>, pathMap: Map<path, node> }

findNode(schema, n => n.type === 'button')        // { node, path } | null
findNodes(schema, n => n.type === 'input')         // Array<{ node, path }>
findPathById(schema, 'submit-btn')                 // 'children.2' | null

const engine = createQueryEngine({ schema, index: result.index })
engine.findById('role-field')                      // { node, path } | null (O(1))
```

---

## Error Types

| Error | When |
|-------|------|
| `VarioError` | Base class for all Vario errors |
| `ActionError` | VM instruction execution failure |
| `ExpressionError` | Expression parse/eval failure |
| `ServiceError` | External service call failure |
| `BatchError` | Collects multiple errors from batch execution |

23 error code constants exported (e.g., `ERR_EXPRESSION_PARSE`, `ERR_ACTION_TIMEOUT`).

---

## Key Constraints

- **Framework-agnostic** — never import Vue or any UI framework
- State access is flat: `ctx._set('count', 1)` not `ctx._set('models.count', 1)`
- Expression sandbox: no arbitrary code execution, whitelist-only
- All caches have size limits (expression: 100/ctx, path: 2000, loop pool: 100)
- ESM output, `tsup`, `es2022`. Build order: `types → core/schema → vue → cli`
- Tests: `packages/vario-core/__tests__/` (216 tests), Vitest

---

## Reference Files

| File | When to read |
|------|-------------|
| [expression-security.md](references/expression-security.md) | Expression sandbox layers, AST whitelist details, ALLOWED_NODE_TYPES, FORBIDDEN_NODE_TYPES, property blacklist, function whitelist full list, nesting depth enforcement, dangerous pattern detection |
| [vm-instructions.md](references/vm-instructions.md) | Complete instruction handler internals, parameter resolution, expression evaluation in values, error propagation, timeout/maxSteps enforcement, handler registration |
