# RuntimeContext

RuntimeContext 是 Core 的“中央上下文”：**扁平化状态** + **系统 API**（`_get` / `_set`、`$methods`、`$emit` 等）。渲染层和 VM 都围绕它读写状态、执行方法、派发事件。

## 创建上下文

通过 `createRuntimeContext(initialState, options)` 创建（由 Core 导出，Vue 渲染器内部会封装类似逻辑）：

```typescript
import { createRuntimeContext } from '@variojs/core'

const ctx = createRuntimeContext(
  { count: 0, user: { name: 'John', age: 30 } },
  {
    methods: {
      increment: (ctx) => {
        ctx._set('count', ctx._get('count') + 1)
      }
    },
    onEmit: (event, data) => console.log(event, data),
    onStateChange: (path, value) => console.log('change', path, value)
  }
)
```

## 状态访问：直接属性 vs 系统 API

状态在上下文上是**扁平展开**的，没有 `models.` 之类前缀：

```typescript
ctx.count        // 0
ctx.user.name   // 'John'
```

推荐在业务逻辑里用 **`_get` / `_set`**，便于统一走路径解析与 `onStateChange`：

```typescript
ctx._get('count')           // 0
ctx._get('user.name')       // 'John'
ctx._set('count', 10)       // 会触发 onStateChange('count', 10)
ctx._set('user.age', 31)    // 会触发 onStateChange('user.age', 31)
```

`_set` 的第三个参数可传 `{ skipCallback: true }`，避免触发 `onStateChange`（批量更新时有用）。

## 方法调用与事件

- **方法**：挂在 `options.methods`，执行期通过 `ctx.$methods[name](ctx, params)` 调用；Action VM 的 `call` 即走这里。
- **事件**：`ctx.$emit(event, data)` 会调用创建时传入的 `onEmit`。

```typescript
ctx.$emit('submit', { id: 1 })
// 若提供 onEmit，会收到 ('submit', { id: 1 })
```

## 与表达式、VM 的关系

- **表达式**：在求值时会拿到“当前上下文”的视图（沙箱），只能访问该上下文里的状态与白名单能力，不能随意访问全局。
- **VM**：执行 `set` 时调 `ctx._set`，执行 `call` 时从 `ctx.$methods` 取方法并调用，因此 RuntimeContext 是 VM 的数据与行为源。

## 循环中的扩展字段

在循环场景下，上下文上会临时出现 **`$item`**、**`$index`**，供表达式和指令使用（由框架在 `createLoopContext` 中挂上）。详见 [路径与循环上下文](/packages/core/path-and-loop)。

接下来：[表达式系统](/packages/core/expression) 如何基于该上下文做安全求值。
