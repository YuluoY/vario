---
name: vario-vue
description: >-
  Expert knowledge for developing with @variojs/vue — the Vue 3 rendering layer of the Vario Schema-First UI system.
  Covers useVario composable, Schema→VNode rendering, model binding, event handling, directives, expressions,
  control flow (cond/show/loop), Vue features (refs, lifecycle, provide/inject, teleport, transition, keep-alive),
  performance optimization (Scope-Weight Hybrid auto-adaptive: path-memo, subtree componentization, loop componentization),
  schema query API,
  computed/methods registration, error boundaries, node context, and TypeScript type patterns.
  Use this skill whenever the user is working with vario-vue, useVario, schema rendering, writing Vario Schema
  for Vue, configuring renderer options, debugging rendering issues, building forms or dynamic UI with JSON Schema
  in Vue, or asking about any @variojs/vue API. Also trigger when user mentions Vario + Vue, schema-driven rendering,
  Action VM events, model path binding, or VNode creation from schema.
---

# Vario-Vue Skill

Expert guide for `@variojs/vue` — the Vue 3 rendering backend of Vario (Schema-First UI Behavior Runtime).

## Architecture

```
Schema (JSON DSL) → @variojs/core (RuntimeContext + ExpressionEngine + Action VM) → @variojs/vue (useVario → VNode)
```

Dependencies: `@variojs/types` (shared types), `@variojs/core` (runtime engine), `vue` (peer).

Source: `packages/vario-vue/src/` — `composable.ts` (useVario), `renderer.ts` (VueRenderer, 18-step pipeline), `adapter.ts` (Vue reactive bridge), `bindings.ts` (model binding), `features/` (18 feature modules), `composables/` (useSchemaQuery + internal helpers).

---

## useVario Composable

Primary API — converts Schema into Vue VNode.

```typescript
const {
  vnode, state, ctx, refs, error, stats, retry, find, findAll, findById,
} = useVario(schema, options)
```

**Schema input:** static object, factory function `() => schema`, or `ComputedRef<Schema>` (reactive switching).

**Options:**

```typescript
useVario(schema, {
  state: { count: 0 },                    // Initial state (auto-wrapped with reactive())
  computed: { total: (s) => s.a + s.b },   // Synced to RuntimeContext
  methods: {                               // Invoked by Action VM
    onClick: defineMethod<MouseEvent, MyState>(({ value, state, ctx }) => { ... }),
  },
  components: { ElButton },                // Component registry (priority over globals)
  directives: { vFocus: myFocusDirective },// Custom directives
  app: getCurrentInstance()?.appContext.app ?? null,
  modelOptions: { separator: '.', lazy: false },
  modelBindings: { 'MySwitch': { prop: 'checked', event: 'change' } },
  errorBoundary: { enabled: true, fallback: (err) => h('div', err.message) },
  // Performance: all optimizations are auto-adaptive (Scope-Weight Hybrid), zero config needed.
  onEmit: (event, data) => {},
  onError: (err) => {},
})
```

**Rendering pipeline:** resolveSchema → reactive(state) → createVueReactiveAdapter → createRuntimeContext → registerComputed → VueRenderer.render → watch(schema/state) for re-render.

**Template usage:**

```vue
<template>
  <component :is="vnode" v-if="vnode" />
  <div v-else-if="error">{{ error.message }}</div>
</template>
<script setup>
const { vnode, state, error, retry } = useVario(schema, { state: { count: 0 } })
</script>
```

---

## Schema Node Structure

```typescript
{
  type: string,                    // 'div', 'ElButton', etc.
  id?: string,                     // For findById
  props?: Record<string, any>,     // {{ expr }} supported in values
  children?: string | SchemaNode[],
  events?: Record<string, EventAction>,
  model?: string | ModelConfig,    // Bidirectional binding path
  cond?: string | boolean,         // v-if equivalent
  show?: string | boolean,         // v-show equivalent
  loop?: LoopConfig,               // List rendering
  // Vue-specific:
  ref?: string,                    // Template ref
  onMounted?: string,              // Lifecycle hooks → method name
  onUnmounted?: string,  onUpdated?: string,
  onBeforeMount?: string, onBeforeUnmount?: string, onBeforeUpdate?: string,
  provide?: Record<string, any>,   // Provide values (expressions supported)
  inject?: string[] | Record<string, { from: string, default?: any }>,
  teleport?: string | boolean,     // Target selector (true = 'body')
  transition?: string | TransitionConfig,
  keepAlive?: boolean | KeepAliveConfig,
  directives?: DirectiveConfig,
}
```

---

## Model Binding

```typescript
model: 'user.name'                          // Flat path
model: 'users[0].email'                     // Array access
model: '{{ dynamicField }}'                 // Expression path
model: { path: 'form', scope: true }        // Scope container (pushes to path stack)
model: { path: 'name', default: '张三' }     // Default value
model: { path: 'search', modifiers: { trim: true, number: true } }
```

**Path stack:** Scoped parents push path; children resolve relative to stack (`form.user` + `name` → `form.user.name`).

**Named models:** `'model:checked': 'isChecked'` for multi v-model (Vue 3.4+).

**Auto-detection priority:** custom configs → native elements → component inspection → `{ prop: 'modelValue', event: 'update:modelValue' }`.

**Modifiers:** `.trim`, `.number`, `.lazy` (execution order: trim → number → lazy).

---

## Event Handling

```typescript
events: { click: 'handleClick' }                                    // String shorthand
events: { click: { type: 'call', method: 'fn', params: { id: '{{ item.id }}' } } }  // Action object
events: { click: ['call', 'fn', ['p1'], ['stop', 'prevent']] }      // Array shorthand
events: { click: ['validate', { type: 'call', method: 'submit' }] } // Multiple actions
events: { 'click.stop.prevent': 'fn' }                              // Modifiers in name
```

**Modifiers:** `stop`, `prevent`, `capture`, `self`, `once`, `passive`.

**Method context:** `({ state, params, value, event, ctx }) => { ... }` where `ctx` provides `_get/_set/$emit/$self/$parent/$siblings`.

---

## Control Flow

**cond** (v-if): `{ cond: '{{ isLoggedIn }}' }` — removes from VNode tree.

**show** (v-show): `{ show: '{{ isVisible }}' }` — toggles `display: none`.

**loop:**
```typescript
{ loop: { items: '{{ list }}', itemKey: 'item', indexKey: 'index' },
  children: [{ type: 'span', children: '{{ item.name }}' }] }
```
Key priority: `item[itemKey]` → `item.id` → index. Use `model: '.'` to bind loop item itself.

---

## Expressions

`{{ expr }}` supported in all dynamic fields. Sandboxed with whitelisted globals (`Math.*`, `Array.*`, operators).

```typescript
children: 'Total: {{ price * quantity }}'
children: '{{ isVIP ? "VIP" : "Regular" }}'
props: { label: '{{ user?.profile?.name }}' }
```

---

## Vue Features

**Refs:** `{ ref: 'myInput' }` → `refs.myInput.value?.focus()`. Dynamic: `ref: '{{ \`field_${index}\` }}'`.

**Lifecycle:** `onMounted/onUnmounted/onUpdated/onBeforeMount/onBeforeUnmount/onBeforeUpdate/onActivated/onDeactivated` — values are method names. Node auto-wrapped in `defineComponent`.

**Provide/Inject:** `provide: { theme: 'dark' }` on parent; `inject: ['theme']` or `inject: { t: { from: 'theme', default: 'light' } }` on consumer.

**Teleport:** `teleport: '#modal-root'` or `teleport: true` (→ body).

**Transition:** `transition: 'fade'` or `transition: { name: 'slide', appear: true, mode: 'out-in' }`.

**Keep-Alive:** `keepAlive: true` or `keepAlive: { include: [...], max: 10 }`.

**Wrapping order** (outer → inner): Teleport → Transition → Keep-alive → Refs → Directives → Component.

---

## Directives

```typescript
directives: { focus: true, tooltip: 'Hello' }                    // Object form
directives: [{ name: 'focus', value: true }]                     // Full object
directives: [['tooltip', 'Hello', 'top', { animate: true }]]     // Array [name, value, arg, modifiers]
```

Resolved from `UseVarioOptions.directives` or app global directives.

---

## Node Context & Schema Query

**Node context** in methods: `ctx.$self` (current node), `ctx.$parent` (chainable), `ctx.$siblings`, `ctx.$children`. Uses Proxy + WeakMap for O(1) lookups.

**Schema query:**
```typescript
const { find, findAll, findById } = useVario(schema, options)
findById('name-input')?.patch({ props: { disabled: true } })
findAll(n => n.type === 'ElButton').forEach(b => b.patch({ props: { loading: true } }))
```
`NodeWrapper`: `{ path, node, patch(partial), get(key), parent() }`. Lazy analysis, cached until schema changes.

---

## Performance Optimization

All optimizations are **zero-config** via the **Scope-Weight Hybrid** strategy:

| Strategy | Mechanism | Config |
|----------|-----------|--------|
| **path-memo** | Cache static VNode subtrees by path | Always on |
| **Scope-Weight subtree** | Componentize nodes at scope boundary when weight > COMPONENT_OVERHEAD (5) | Auto-adaptive |
| **Scope-Weight loop** | Componentize loop items when template weight > COMPONENT_OVERHEAD (5) | Auto-adaptive |

`COMPONENT_OVERHEAD = 5` is the cost threshold. `computeWeight()` calculates subtree weight (cached in WeakMap). `isScopeBoundary()` checks model/component/lifecycle/provide.

**No `rendererOptions` needed** — all deprecated fields (`usePathMemo`, `loopItemAsComponent`, `subtreeComponent`, `schemaFragment`) have been removed.

**`directives`** is now a top-level option in `UseVarioOptions` (not nested in `rendererOptions`).

---

## Error Handling

```typescript
errorBoundary: { enabled: true, fallback: (err) => h('div', err.message), onRecover: (err) => log(err) }
```

`retry()` from useVario re-renders after error. Error types: `VarioError`, `ExpressionError`, `ActionError`, `ServiceError`.

---

## TypeScript Patterns

```typescript
// Typed methods
const methods = {
  onInput: defineMethod<string, MyState>(({ value, state }) => { state.name = value }),
}
// Typed state
const { state } = useVario<FormState>(schema, { state: { name: '', age: 0 } })
```

---

## Key Constraints

- `@variojs/core` is framework-agnostic — never import Vue APIs in core
- `@variojs/types` is the single source of shared types — no business logic
- All packages: ESM output, `tsup`, `es2022`. Build order: `types → core/schema → vue → cli`
- Expressions sandboxed — no arbitrary code execution
- State access is flat: `ctx._set('count', 1)` not `ctx._set('models.count', 1)`
- System API prefix: `_get/_set/$emit/$methods/$self/$parent`
- Tests: `packages/vario-vue/__tests__/`, Vitest, `pnpm --filter @variojs/vue test`

---

## Reference Files

The `references/` directory contains detailed deep-dive documents. Read them when the SKILL.md summary above is insufficient for the task at hand.

| File | When to read |
|------|-------------|
| [model-binding.md](references/model-binding.md) | Path stack mechanics, 7 path formats, auto-detection chain, named models, modifier internals, default values, loop context binding |
| [events-actions.md](references/events-actions.md) | 5 event syntax formats, detection logic, Action VM integration, MethodContext full API, modifier behavior, WeakMap caching, preprocessActionsParams |
| [vue-features.md](references/vue-features.md) | Refs registry internals, lifecycle wrapper, provide/inject expression evaluation, teleport/transition/keep-alive, directives normalization, VNode wrapping order |
| [control-flow.md](references/control-flow.md) | cond/show implementation details, loop handler full flow, createLoopContext, markLoopSchema, key priority, Fragment wrapping, expression evaluation, text interpolation regex, slot detection and resolution |
| [performance.md](references/performance.md) | PathMemoCache internals, canMemo conditions, Plans B/C/D implementation details, shouldComponentize criteria, SchemaStore reactive map, recommended plan combinations |
| [schema-query-context.md](references/schema-query-context.md) | SchemaQueryApi, NodeWrapper, SchemaAnalyzer lazy analysis, NodeContext interface, ctx variables ($self/$parent/$siblings/$children), Proxy+WeakMap chain |
| [patterns.md](references/patterns.md) | Complete code recipes: form, data table, loop cards, scoped slots, computed chains, conditional UI, event patterns, dialog/modal, pagination — with Element Plus examples |
