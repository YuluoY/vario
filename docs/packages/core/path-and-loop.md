# 路径与循环上下文

Core 提供**路径解析、按路径取值/设值**，以及**循环上下文**的创建与释放，供 Schema 的 `model`、`loop` 与 VM 的 `set`、`loop` 使用。

## 路径工具

### parsePath / stringifyPath

把字符串路径拆成段落，或反过来组装：

```typescript
import { parsePath, stringifyPath } from '@variojs/core'

parsePath('user.profile.name')     // ['user','profile','name']
parsePath('items[0].title')        // ['items', 0, 'title']
stringifyPath(['a', 1, 'b'])       // 'a.1.b'
```

**parsePathCached** 会对解析结果做缓存；**clearPathCache** 用于清空缓存。

### getPathValue / setPathValue

按路径读写普通对象（不依赖 RuntimeContext）：

```typescript
import { getPathValue, setPathValue } from '@variojs/core'

const obj = { user: { name: 'John' }, list: [10, 20] }

getPathValue(obj, 'user.name')     // 'John'
getPathValue(obj, 'list.0')        // 10

setPathValue(obj, 'user.age', 30)
setPathValue(obj, 'list.2', 30, {
  createObject: () => ({}),
  createArray: () => []
})
```

若路径上缺对象/数组，`setPathValue` 会用 `createObject` / `createArray` 自动建链，方便“按路径自动建状态”的场景。

### getParentPath / getLastSegment

从路径中取父路径或最后一段，便于做“同父级下的其它字段”等逻辑：

```typescript
import { getParentPath, getLastSegment } from '@variojs/core'

getParentPath('user.profile.name')  // 'user.profile'
getLastSegment('user.profile.name') // 'name'
```

### matchPath

判断某路径是否匹配给定模式（含通配），用于依赖收集、按路径失效缓存等：

```typescript
import { matchPath } from '@variojs/core'

matchPath('user.*', 'user.name')   // true
matchPath('list.*.id', 'list.0.id') // true
```

## 循环上下文

在执行 `loop` 或渲染“列表项”时，需要为每一项提供 **$item**、**$index** 等，Core 用“循环上下文”封装这一层。

### createLoopContext / releaseLoopContext

```typescript
import { createLoopContext, releaseLoopContext } from '@variojs/core'

const loopCtx = createLoopContext(ctx, {
  item: { id: 1, name: 'A' },
  index: 0
})

// 在 loopCtx 上可访问 loopCtx.$item、loopCtx.$index，用于表达式与 body 中的 Action
await execute(bodyActions, loopCtx)

releaseLoopContext(loopCtx)  // 用完后归还到池里，减少 GC
```

**池化**：循环上下文会被复用，避免频繁创建对象。在大量列表或 VM 的 `loop` 中，应成对调用 `createLoopContext` / `releaseLoopContext`。

## 在 Schema / Vue 中的使用方式

- **@vario/vue** 的 path-resolver、attrs-builder、loop-handler 会调用 `parsePath`、`getPathValue`、`setPathValue` 以及循环上下文，实现 `model: "user.name"`、`loop: { items: '{{ list }}', itemKey: 'item' }` 等。
- VM 的 `loop` 处理器内部会对 `in` 求值得到数组，然后对每一项 `createLoopContext` → `execute(body)` → `releaseLoopContext`。

因此“路径 + 循环上下文”是 Core 与渲染层之间的契约，而不是直接面向业务写死的 UI 逻辑。下一步：[安全与性能](/packages/core/security-performance)。
