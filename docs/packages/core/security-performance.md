# 安全与性能

## 安全

### 表达式白名单与沙箱

- 表达式**不能**使用：`eval`、`Function`、`globalThis`、`window`、`require`、`process` 等。
- 仅可访问传入的**上下文视图**中的状态，以及白名单中的函数（如 `Array.isArray`、`Math.max`、`JSON.parse` / `JSON.stringify` 等）。
- 使用 **validateAST** 可在执行前检查 AST 是否含非法节点。

因此从 Schema 或用户输入拼接出的表达式字符串，在默认配置下不会获得执行任意代码的能力。

### VM 执行上限

- **execute** 支持 `timeout`（毫秒）和 `maxSteps`（步数），避免无限循环或过长逻辑拖垮页面。
- 建议生产环境显式设置，例如：`{ timeout: 5000, maxSteps: 10000 }`。

### 状态变化可控

- 所有通过 `_set` 的写入都可被 **onStateChange** 接到，便于做审计、埋点或拦截危险路径。

## 性能

### 表达式缓存

- 同一表达式字符串多次 **evaluateExpression** / **compile** 时，会复用“编译结果”，减少重复解析。
- 若 Schema 或状态路径在运行时变化很大，可适时 **invalidateCache** / **clearCache**，或通过 **getCacheStats** 观察命中率。

### 路径缓存

- **parsePathCached** 会缓存路径解析结果；路径模式固定时能减少重复解析。必要时 **clearPathCache**。

### 循环上下文池

- **createLoopContext** / **releaseLoopContext** 成对使用，让短暂存在的循环上下文被池化复用，减轻 GC 压力，尤其在大列表、多次 `loop` 时有效。

### 批量更新

- 若在一次用户操作中多次 `_set`，可在最后一次再触发 UI 更新，或对中间调用使用 `_set(path, value, { skipCallback: true })`，最后再手动触一次 `onStateChange` 或由框架批量刷新。

## 建议配置示例

```typescript
createRuntimeContext(
  { /* state */ },
  {
    methods: { ... },
    onStateChange: (path, value) => { /* 埋点 / 同步 */ },
    exprOptions: {
      maxSteps: 1e4,
      timeout: 3000,
      maxNestingDepth: 50,
      allowGlobals: false
    }
  }
)

execute(actions, ctx, { timeout: 5000, maxSteps: 10000 })
```

更多实践见 [Core 最佳实践](/packages/core/best-practices)。
