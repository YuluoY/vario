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
当节点声明了任意生命周期钩子或 provide/inject 时，`VueRenderer` 会将该节点包裹在 `defineComponent` 中（而非直接 `h()` 调用）：

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
在 18 步管线的**最外层**包裹：
```typescript
h(Teleport, { to: target }, [vnode])
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

## VNode Wrapping Order

在 `VueRenderer.createVNode()` 18步管线中，各 Vue 特性的包裹顺序（从内到外）：

```
Component (h() 调用)
  → attachRef (ref 附加)
    → withDirectives (指令)
      → KeepAlive (缓存)
        → Transition (过渡动画)
          → Teleport (传送，最外层)
```

这意味着：
- Teleport 在最外层，传送的是包含了所有特性的完整 VNode
- Transition 包裹在 KeepAlive 外面
- 指令直接附加在组件 VNode 上
- Ref 在指令之前附加

注意：Lifecycle 包裹（`defineComponent`）发生在 `h()` 调用阶段作为替代方案，不在后续包裹链中。
