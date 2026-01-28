# @vario/core API 参考

## Runtime

### createRuntimeContext

```typescript
function createRuntimeContext<TState extends Record<string, unknown>>(
  options: CreateContextOptions<TState>
): RuntimeContext<TState>
```

**createRuntimeContext(initialState, options)**：第一个参数为初始状态，第二个为可选配置。

**CreateContextOptions**（options 的字段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| methods | MethodsRegistry | 方法表，供 VM `call` 使用 |
| onEmit | (event, data?) => void | 事件回调 |
| onStateChange | (path, value, ctx) => void | 状态写后的回调 |
| createObject | () => object | setPathValue 建链时创建对象 |
| createArray | () => unknown[] | setPathValue 建链时创建数组 |
| exprOptions | ExpressionOptions | 表达式步数/超时/深度等 |

### createProxy / createExpressionSandbox

- **createProxy(ctx)**：返回一个适合表达式求值使用的代理视图。
- **createExpressionSandbox(ctx)**：返回表达式沙箱实例，内部使用上下文视图，不暴露裸 ctx。

### createLoopContext / releaseLoopContext

```typescript
function createLoopContext(ctx: RuntimeContext, payload: { item: unknown; index: number }): RuntimeContext
function releaseLoopContext(loopCtx: RuntimeContext): void
```

## 路径

| 函数 | 签名概要 | 说明 |
|------|-----------|------|
| parsePath | (path: string) => PathSegment[] | 解析路径 |
| parsePathCached | (path: string) => PathSegment[] | 带缓存的解析 |
| clearPathCache | () => void | 清空路径缓存 |
| stringifyPath | (segments: PathSegment[]) => string | 段落拼回路径 |
| getPathValue | (obj, path) => unknown | 按路径取值 |
| setPathValue | (obj, path, value, options?) => void | 按路径设值，可建链 |
| getParentPath | (path: string) => string | 父路径 |
| getLastSegment | (path: string) => string \| number | 最后一段 |
| matchPath | (pattern: string, path: string) => boolean | 模式匹配 |

## 表达式

| 函数 | 说明 |
|------|------|
| parseExpression(expr) | 解析为 AST |
| validateAST(ast) | 校验 AST 安全性 |
| evaluateExpression(expr, ctx) | 求值 |
| extractExpression(str) | 从 `{{ }}` 中抽取表达式字符串 |
| extractDependencies(ast) | 从 AST 抽取依赖路径列表 |
| getCachedExpression / setCachedExpression / invalidateCache / clearCache / getCacheStats | 缓存查询与清理 |

## VM

```typescript
function execute(
  actions: Action[],
  ctx: RuntimeContext,
  options?: ExecuteOptions
): Promise<void>

function registerBuiltinMethods(ctx: RuntimeContext): void
```

**ExecuteOptions**：`{ timeout?: number; maxSteps?: number }`

**Action**：`{ type: string; [key: string]: unknown }`，常见 `type` 见 [Action VM](/packages/core/action-vm)。

## 错误

从 `@variojs/core` 可拿到 **ActionError**、**ExpressionError**、**ServiceError**、**BatchError**、**VarioError** 与 **ErrorCodes**，用于区分错误类型与做结构化上报。
