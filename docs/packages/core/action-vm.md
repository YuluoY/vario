# Action VM

Action VM 根据动作的 **`type`** 派发到对应处理器，执行“改状态、调方法、发事件、分支、循环”等。Schema 中的 `events.click`、`events.change` 等配置的数组，都会在对应框架层被转成 Action 序列交给 VM 执行。

## 执行入口

```typescript
import { execute, createRuntimeContext, registerBuiltinMethods } from '@variojs/core'

const ctx = createRuntimeContext({ state: { count: 0 }, methods: { ... } })
registerBuiltinMethods(ctx)  // 注册 set / call / if / loop / batch 等内置

await execute(
  [
    { type: 'set', path: 'count', value: 10 },
    { type: 'call', method: 'onCountChange' }
  ],
  ctx,
  { timeout: 5000, maxSteps: 10000 }
)
```

`execute(actions, ctx, options)` 会按顺序执行每个 Action；`options` 可配超时与最大步数，防止死循环或过长执行。

## 内置动作（由简到繁）

### 原子类

- **set**：写状态  
  `{ type: 'set', path: 'user.name', value: 'Jane' }` 或 `value: '{{ newName }}'`（字符串会当表达式求值）
- **emit**：发事件  
  `{ type: 'emit', event: 'submit', data: { id: 1 } }`
- **navigate**：导航（由集成层实现）  
  `{ type: 'navigate', to: '/home' }`
- **log**：打日志  
  `{ type: 'log', message: 'done', level: 'info' }`

### 控制流

- **if**：条件执行  
  `{ type: 'if', cond: 'count > 0', then: [...], else: [...] }`  
  `then` / `else` 为 Action 数组，可再嵌套 `if`、`call`、`batch` 等。
- **loop**：循环执行  
  `{ type: 'loop', var: 'item', in: '{{ items }}', body: [...] }`  
  对 `items` 的每个元素创建循环上下文（`$item`、`$index`），再执行 `body`。
- **call**：调上下文方法  
  `{ type: 'call', method: 'increment' }` 或带参  
  `{ type: 'call', method: 'save', params: { id: '{{ id }}' }, resultTo: 'lastId' }`  
  `resultTo` 表示把返回值写到状态的某路径。
- **batch**：顺序执行多条  
  `{ type: 'batch', actions: [ { type: 'set', ... }, { type: 'call', ... } ] }`

### 数组操作

- **push / pop / shift / unshift / splice**：对状态中数组路径做相应操作，例如：  
  `{ type: 'push', path: 'todos', value: { title: 'New' } }`  
  `{ type: 'splice', path: 'todos', start: 0, deleteCount: 1 }`

所有“值”类型字段若为字符串，会先当表达式在当前上下文中求值再使用。

## 错误与超时

- 某个 Action 执行失败会抛出 **ActionError**，携带动作内容与错误码。
- **execute** 的 `timeout`、`maxSteps` 用于限制总执行时间与步数，超出会抛错并中止后续动作。

详见 [安全与性能](/packages/core/security-performance)。

## 与 Schema / Vue 的对应关系

- Schema 里 `events: { click: [ { type: 'call', method: 'submit' } ] }` 会在 Vue 层被转成对 `execute(..., ctx)` 的调用。
- VM 不关心 UI，只关心上下文；因此同一个 Context 也可在 Node、测试或其它渲染端复用。

下一步：[路径与循环上下文](/packages/core/path-and-loop) 中 `$item`、`$index` 与路径解析如何配合 VM 的 `loop` 使用。
