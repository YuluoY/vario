# Events & Actions — Deep Reference

> 读取时机：用户处理事件绑定、Action VM、方法定义、事件修饰符、批量操作序列、MethodContext 参数时读取。

## Table of Contents
1. [Event Syntax Formats](#event-syntax-formats)
2. [Event Name Parsing & Modifiers](#event-name-parsing--modifiers)
3. [Action VM Integration](#action-vm-integration)
4. [MethodContext API](#methodcontext-api)
5. [Batch Action Execution](#batch-action-execution)
6. [Event Handler Cache](#event-handler-cache)
7. [Loop/Slot Param Preprocessing](#loopslot-param-preprocessing)
8. [defineMethod Type Helper](#definemethod-type-helper)

---

## Event Syntax Formats

源码：`packages/vario-vue/src/event-handler.ts` — `normalizeEventHandler()`

### Format 1: String Shorthand
```json
{ "events": { "click": "handleClick" } }
```
转换为 `[{ type: 'call', method: 'handleClick' }]`。

### Format 2: Action Object
```json
{
  "events": {
    "click": {
      "type": "call",
      "method": "submit",
      "params": { "id": "{{ item.id }}", "name": "{{ form.name }}" }
    }
  }
}
```
直接传递给 Action VM 执行。

### Format 3: Action Array（批量动作）
```json
{
  "events": {
    "click": [
      "validate",
      { "type": "call", "method": "submit" },
      { "type": "emit", "event": "formSubmitted" }
    ]
  }
}
```
字符串元素自动转为 `{ type: 'call', method: str }`，按顺序执行。

### Format 4: String Array
```json
{ "events": { "click": ["validate", "submit", "notify"] } }
```
每个字符串 → `{ type: 'call', method: str }`。与 Format 3 区别：全元素均为字符串。

### Format 5: Array Shorthand（元组格式）
```json
{ "events": { "click": ["call", "fn", ["param1", "param2"], ["stop", "prevent"]] } }
```
格式：`[type, method, params?, modifiers?]`

- `params` 为数组时 → 位置参数
- `params` 为对象时 → 命名参数
- `modifiers` 为字符串数组 → 事件修饰符

**检测逻辑：** 若数组第一个元素是 `'call'` 且第二个是字符串 → 按元组解析；否则按 Format 3/4 处理。

---

## Event Name Parsing & Modifiers

源码：`parseEventName()`, `parseModifiers()`, `applyEventModifiers()`

### 事件名解析
```json
{ "events": { "click.stop.prevent": "handler" } }
```
`parseEventName('click.stop.prevent')` → `{ eventName: 'click', modifiers: ['stop', 'prevent'] }`

点号分割，第一段为事件名，其余为修饰符。

### 修饰符行为

| 修饰符 | 位置 | 行为 |
|--------|------|------|
| `stop` | 事件名/action | `event.stopPropagation()` |
| `prevent` | 事件名/action | `event.preventDefault()` |
| `self` | 事件名/action | `event.target !== event.currentTarget` 时中止 |
| `once` | 事件名/action | 通过 `executed` 标志实现一次性触发 |
| `capture` | 事件名 | 设为 `__modifiers.capture = true`，Vue 通过事件选项处理 |
| `passive` | 事件名 | 设为 `__modifiers.passive = true`，Vue 通过事件选项处理 |

### 修饰符来源合并
修饰符可来自两处，合并后去重：
1. **事件名中：** `click.stop` → `['stop']`
2. **Action 定义中：** `{ type: 'call', method: 'fn', modifiers: ['prevent'] }`

合并结果：`['stop', 'prevent']`

### capture/passive 处理
这两个修饰符不通过 `applyEventModifiers()` 处理，而是作为 `__modifiers` 元数据附加到事件处理函数上：
```javascript
handler.__modifiers = { capture: true, passive: true }
```
Vue 的事件系统会读取 `__modifiers` 来配置事件监听器选项。

---

## Action VM Integration

源码：`executeInstructions()` in `event-handler.ts`

事件触发时调用链：
```
Event received → applyEventModifiers() → executeInstructions(actions, eventValue, ctx)
                                           ↓
                                     @variojs/core execute()
                                           ↓
                                     Action type routing:
                                       'call' → ctx.$methods[method](methodCtx)
                                       'emit' → ctx.$emit(event, data)
                                       'set'  → ctx._set(path, value)
```

### Action Types

**call（调用方法）:**
```json
{ "type": "call", "method": "handleSubmit", "params": { "id": 1 } }
```

**emit（触发事件）:**
```json
{ "type": "emit", "event": "save", "data": "{{ formData }}" }
```
通过 `options.onEmit` 回调传出。

**set（直接设值）:**
```json
{ "type": "set", "path": "loading", "value": true }
```

### 事件值传递
```
原生 DOM 事件 → event 对象作为 value
Vue 组件 emit → emit 的参数作为 value
  - 单参数：直接传递
  - 多参数：作为数组传递
```

---

## MethodContext API

```typescript
interface MethodContext<TState, TEvent> {
  state: TState          // 响应式状态（直接读写）
  params: any            // Schema 中定义的 params
  value: TEvent          // 事件值（推荐）
  event?: TEvent         // @deprecated 向后兼容
  ctx: RuntimeContext    // 完整运行时上下文
}
```

### ctx 可用API
```typescript
ctx._get(path)          // 读取状态
ctx._set(path, value)   // 写入状态
ctx.$emit(event, data)  // 触发事件
ctx.$methods            // 方法注册表
ctx.$self               // 当前节点上下文（Proxy）
ctx.$parent             // 父节点上下文（可链式访问）
ctx.$siblings           // 兄弟节点数组
ctx.$children           // 子节点数组
ctx.$index              // 当前循环索引（loop 内可用）
ctx.$item               // 当前循环项（loop 内可用）
```

### 方法注册表构建
源码：`composables/internal/method-registry.ts` — `buildMethodsRegistry()`

用户定义的 methods 会被包装：
```typescript
// 用户定义
methods: {
  onClick: ({ value, state }) => { state.count++ }
}

// 内部包装后注册到 ctx.$methods
ctx.$methods.onClick = (runtimeCtx, eventValue) => {
  return userFn({
    state: reactiveState,
    params: runtimeCtx.__actionParams,
    value: eventValue,
    event: eventValue,
    ctx: runtimeCtx
  })
}
```

---

## Batch Action Execution

多个 Action 按数组顺序同步执行：

```json
{
  "events": {
    "click": [
      { "type": "set", "path": "loading", "value": true },
      { "type": "call", "method": "validate" },
      { "type": "call", "method": "submit" },
      { "type": "set", "path": "loading", "value": false }
    ]
  }
}
```

执行顺序保证：loading=true → validate() → submit() → loading=false。

每个 action 的 `execute()` 调用来自 `@variojs/core`，支持完整的 Action VM 指令集。

---

## Event Handler Cache

源码：`getEventHandlers()` 使用 `WeakMap<SchemaNode, Record<string, Function>>`

### 缓存策略
- 默认：对同一 SchemaNode 引用的事件处理器**缓存**结果
- **跳过缓存**的场景：
  - Loop 节点（`__loopItems` 标记存在）
  - Scoped slot 上下文
  - Node context 启用时

为什么跳过？因为 loop/slot 中同一 SchemaNode 在不同迭代中有不同的 ctx（$index, $item 不同），缓存会导致闭包捕获错误的上下文。

---

## Loop/Slot Param Preprocessing

源码：`preprocessActionsParams()`

在 loop 或 scoped slot 内，Action 的 params 中的表达式 `{{ expr }}` 需要**提前求值**（闭包捕获），否则事件触发时循环变量已失效：

```json
{ "type": "call", "method": "remove", "params": { "id": "{{ item.id }}" } }
```

在 loop 渲染时立即对 `{{ item.id }}` 求值（假设为 `42`），替换 params：
```javascript
{ type: 'call', method: 'remove', params: { id: 42 } }
```

**触发条件：** 当前 SchemaNode 被标记为 `__loopItems` 或处于 scoped slot 上下文中。

---

## defineMethod Type Helper

```typescript
import { defineMethod } from '@variojs/vue'

const methods = {
  // value 类型推导为 string[]
  onCollapseChange: defineMethod<string[]>(({ value }) => {
    activeNames.value = value
  }),

  // value 推导为 MouseEvent, state 推导为 MyState
  onClick: defineMethod<MouseEvent, MyState>(({ value, state }) => {
    console.log(value.clientX, state.count)
  }),

  // 访问 params（来自 Schema 的 action params）
  onDelete: defineMethod<void, MyState>(({ params, state }) => {
    state.items = state.items.filter(i => i.id !== params.id)
  })
}
```

`defineMethod` 是透传函数（identity），仅用于 TypeScript 类型推导，无运行时开销。
