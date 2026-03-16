# Vue Features — Deep Reference

> 读取时机：用户使用 refs、生命周期钩子、provide/inject、teleport、transition、keep-alive、directives 等 Vue 特性时读取。

## Table of Contents
1. [Refs (Template References)](#refs)
2. [Lifecycle Hooks](#lifecycle-hooks)
3. [Provide / Inject](#provide--inject)
4. [Teleport](#teleport)
5. [Transition](#transition)
6. [Keep-Alive](#keep-alive)
7. [Directives](#directives)
8. [VNode Wrapping Order](#vnode-wrapping-order)

---

## Refs

源码：`packages/vario-vue/src/features/refs.ts` — `RefsRegistry`, `attachRef()`

### 基本用法
```json
{ "type": "ElInput", "ref": "myInput" }
```
```typescript
const { refs } = useVario(schema, options)
// refs 是 Proxy 对象，动态访问任何 ref
refs.myInput.value?.focus()
```

### 实现机制
`RefsRegistry` 使用 `Map<string, Ref<any>>` 存储，外层通过 `Proxy` 实现**懒注册**：
- 访问 `refs.xxx` 时，若 `xxx` 不存在 → 自动调用 `register(xxx)` 创建 `ref(null)` 并返回
- 因此不需要提前声明，直接通过属性名访问即可
- `getAll()` 返回同一个 Proxy 实例（缓存），避免重复创建

### Dynamic Ref
```json
{ "type": "ElInput", "ref": "{{ `field_${index}` }}" }
```
表达式求值后的字符串作为 ref 名称。

### attachRef 过程
1. `schema.ref` 存在 → `refsRegistry.register(name)` 获取 Ref
2. 构建 `NormalizedVNodeRef` 对象 `{ i: owner, r: refValue, k: schema.ref }`
3. 与 VNode 上已有的 ref 合并（支持多 ref）
4. 附加到 `vnode.ref`

### API
```typescript
class RefsRegistry {
  register(name: string): Ref<any>      // 注册并返回 ref
  getAll(): Record<string, Ref<any>>    // 返回 Proxy
  get(name: string): Ref<any> | undefined
  clear(): void                          // 组件卸载时清理
  remove(name: string): boolean
}
```

---

## Lifecycle Hooks

源码：`packages/vario-vue/src/features/lifecycle-wrapper.ts` — `LifecycleWrapper`

### Schema 声明
```json
{
  "type": "ElForm",
  "onMounted": "initForm",
  "onUnmounted": "cleanup",
  "onUpdated": "onFormUpdated"
}
```
值为**方法名**（对应 `methods` 中注册的函数）。

### 支持的钩子
| Schema 字段 | Vue 钩子 | 时机 |
|-------------|----------|------|
| `onBeforeMount` | `onBeforeMount` | 挂载前 |
| `onMounted` | `onMounted` | 挂载后 |
| `onBeforeUpdate` | `onBeforeUpdate` | 更新前 |
| `onUpdated` | `onUpdated` | 更新后 |
| `onBeforeUnmount` | `onBeforeUnmount` | 卸载前 |
| `onUnmounted` | `onUnmounted` | 卸载后 |

### 实现机制
当节点声明了任意生命周期钩子或 provide/inject 时，`lifecyclePlugin`（VNodePlugin）通过 `wrapComponent` hook 将该节点包裹在 `defineComponent` 中（而非直接 `h()` 调用）：

> **注意**：lifecycle/provide-inject 逻辑已从渲染器硬编码迁移至 `packages/vario-vue/src/plugins/lifecycle.ts` 插件，通过 `VNodePlugin.wrapComponent` hook 实现。

```
createComponentWithLifecycle(component, attrs, children, schema, ctx)
  → h(defineComponent({
      name: 'VarioLifecycleWrapper',
      setup() {
        // 处理 provide/inject
        const injectedValues = setupProvideInject(schema, ctx)
        // 注册各生命周期钩子
        if (schema.onMounted) {
          onMounted(() => methods[schema.onMounted](ctx, undefined))
        }
        // ... 其他钩子
        return () => h(component, mergedAttrs, children)
      }
    }))
```

### 注意事项
- 钩子通过 `Promise.resolve(hook(...)).catch()` 包装，支持异步方法且不会中断渲染
- 错误仅 `console.warn`，不会抛出
- 只有声明了 `onXxx` 或 `provide/inject` 的节点才会创建包装组件（性能优化）

---

## Provide / Inject

源码：`packages/vario-vue/src/features/provide-inject.ts`

### Provide

```json
{
  "type": "div",
  "provide": {
    "theme": "dark",
    "locale": "currentLocale",
    "config": "{{ appConfig }}"
  }
}
```

**表达式求值：** `looksLikeExpression(str)` 判断值是否为表达式：
- 简单标识符如 `currentLocale` → `true`（尝试从 ctx 中求值）
- 点号访问如 `app.config` → `true`
- 含运算符 → `true`
- 求值失败或结果为 `undefined` → 使用原始字符串

### Inject

三种格式：

**数组形式：**
```json
{ "type": "ElButton", "inject": ["theme", "locale"] }
```

**简单映射：**
```json
{ "type": "ElButton", "inject": { "myTheme": "theme" } }
```
`myTheme` 是本地 key，`theme` 是 provide 的 key。

**完整配置：**
```json
{
  "type": "ElButton",
  "inject": {
    "myTheme": { "from": "theme", "default": "light" }
  }
}
```

### 处理流程
1. `setupProvide(schema, ctx)` → 遍历 `provide` 对象，对每个值尝试表达式求值，调用 Vue `provide(key, resolvedValue)`
2. `setupInject(schema)` → 规范化 `inject` 配置，调用 Vue `inject(from, defaultValue)`，返回 `{ localKey: value }` 对象
3. 返回的 inject 值合并到组件 attrs 中

---

## Teleport

### Schema
```json
{ "type": "div", "teleport": "#modal-root" }
{ "type": "div", "teleport": "body" }
{ "type": "div", "teleport": true }
```
- 字符串 → CSS 选择器目标
- `true` → 传送到 `body`
- `false` / 省略 → 不传送

### 渲染
通过 `teleportPlugin`（VNodePlugin）的 `decorateVNode` hook 在管线第 13 步（后处理装饰器）包裹：
```typescript
// plugins/teleport.ts
decorateVNode(vnode, schema) {
  if (!shouldTeleport(schema.teleport)) return vnode
  return createTeleport(schema.teleport, vnode)  // h(Teleport, { to }, [vnode])
}
```

---

## Transition

### Schema
```json
{ "type": "div", "transition": "fade" }
```
```json
{
  "type": "div",
  "transition": {
    "name": "slide",
    "appear": true,
    "mode": "out-in",
    "duration": { "enter": 300, "leave": 200 }
  }
}
```

### 类型
```typescript
type TransitionConfig = string | {
  name?: string
  appear?: boolean
  mode?: 'default' | 'in-out' | 'out-in'
  duration?: number | { enter?: number; leave?: number }
}
```

### 渲染
```typescript
// string → { name: str }
h(Transition, transitionProps, () => vnode)
```

---

## Keep-Alive

### Schema
```json
{ "type": "div", "keepAlive": true }
```
```json
{
  "type": "div",
  "keepAlive": {
    "include": ["ComponentA", "ComponentB"],
    "exclude": "ComponentC",
    "max": 10
  }
}
```

### 类型
```typescript
type KeepAliveConfig = boolean | {
  include?: string | RegExp | Array<string | RegExp>
  exclude?: string | RegExp | Array<string | RegExp>
  max?: number
}
```

### 渲染
```typescript
h(KeepAlive, keepAliveProps, () => vnode)
```

`max` 遵循 Vue KeepAlive 的 LRU 淘汰策略。

---

## Directives

源码：`packages/vario-vue/src/features/directive-handler.ts` — `DirectiveHandler`

### 四种声明格式

**对象映射：**
```json
{ "directives": { "focus": true, "tooltip": "Hello" } }
```

**完整对象（含 name）：**
```json
{ "directives": { "name": "focus", "value": true } }
```

**完整对象数组：**
```json
{ "directives": [{ "name": "focus", "value": true }, { "name": "tooltip", "value": "text" }] }
```

**数组简写：**
```json
{ "directives": [["tooltip", "Hello", "top", { "animate": true }]] }
```
格式：`[name, value?, arg?, modifiers?]`

### 规范化过程
所有格式统一为 `DirectiveObject[]`:
```typescript
interface DirectiveObject {
  name: string
  value?: any
  arg?: string
  modifiers?: Record<string, boolean>
}
```

### 指令值表达式
`value` 支持 `{{ expr }}` 格式，渲染时自动求值：
```json
{ "directives": { "tooltip": "{{ tooltipText }}" } }
```

### 指令解析优先级
1. `UseVarioOptions.directives` 中注册的自定义指令
2. `app.directive()` 全局注册的指令
3. 找不到 → `console.warn` + 空指令占位

### 内置指令
`DirectiveHandler.registerBuiltInDirectives()` 注册了 `v-focus`：
```typescript
directiveMap.set('focus', {
  mounted(el, binding) {
    if (binding.value !== false) el.focus()
  }
})
```

### 渲染
```typescript
import { withDirectives } from 'vue'
withDirectives(vnode, directiveArguments)
```

---

## VNode Plugin Architecture

所有 Vue 特有特性已从渲染器硬编码逻辑抽离为可组合的 `VNodePlugin`：

```typescript
interface VNodePlugin {
  name: string
  wrapComponent?: (component, attrs, children, schema, ctx) => VNode | null  // 替代 h() 调用
  decorateVNode?: (vnode, schema, ctx) => VNode                              // VNode 后处理包裹
}
```

### 内置插件

| 插件 | Hook | Schema 字段 | 源码 |
|------|------|------------|------|
| `lifecyclePlugin` | `wrapComponent` | `onMounted`/`onUnmounted`/`provide`/`inject` 等 | `plugins/lifecycle.ts` |
| `keepAlivePlugin` | `decorateVNode` | `keepAlive` | `plugins/keep-alive.ts` |
| `transitionPlugin` | `decorateVNode` | `transition` | `plugins/transition.ts` |
| `teleportPlugin` | `decorateVNode` | `teleport` | `plugins/teleport.ts` |

### defaultPlugins

```typescript
export const defaultPlugins: VNodePlugin[] = [
  lifecyclePlugin,     // wrapComponent: lifecycle + provide/inject
  keepAlivePlugin,     // decorateVNode: KeepAlive 包裹
  transitionPlugin,    // decorateVNode: Transition 包裹
  teleportPlugin,      // decorateVNode: Teleport 包裹（最外层）
]
```

### Hook 语义

- **`wrapComponent`**: 拦截 `h()` 调用。第一个返回非 `null` 的插件胜出（短路）。适用于需要 `defineComponent` 包装的场景。
- **`decorateVNode`**: `h()` 之后的链式装饰。所有插件按顺序执行，每个接收上一个的输出。适用于外层包裹。

### 按需加载

```typescript
import { lifecyclePlugin, teleportPlugin } from '@variojs/vue'

// 只加载需要的插件（其余被 tree-shake）
useVario(schema, { plugins: [lifecyclePlugin, teleportPlugin] })

// 禁用所有插件
useVario(schema, { plugins: [] })
```

### 自定义插件

```typescript
const authPlugin: VNodePlugin = {
  name: 'auth',
  decorateVNode(vnode, schema, ctx) {
    const role = (schema.props as any)?.['data-require-role']
    if (!role || ctx._get?.('userRole') === role) return vnode
    return h(Comment, `auth: requires ${role}`)
  }
}
useVario(schema, { plugins: [...defaultPlugins, authPlugin] })
```

---

## VNode Wrapping Order

在 `VueRenderer.createVNode()` 14 步管线中，Vue 特性通过插件 hook 处理：

```
步骤 12 — wrapComponent 插件（lifecyclePlugin）或默认 h() 调用
  → attachRef (ref 附加)
    → withDirectives (指令)
步骤 13 — decorateVNode 插件链：
      → keepAlivePlugin (缓存)
        → transitionPlugin (过渡动画)
          → teleportPlugin (传送，最外层)
```

这意味着：
- lifecyclePlugin 通过 `wrapComponent` 在 h() 阶段接管，用 `defineComponent` 包装
- keepAlivePlugin/transitionPlugin/teleportPlugin 通过 `decorateVNode` 按注册顺序链式包裹
- Teleport 在最外层，传送的是包含了所有特性的完整 VNode
- 指令直接附加在组件 VNode 上，Ref 在指令之前附加
- 自定义插件可在任一阶段插入，遵循相同的 hook 语义
