# @variojs/core

Vario Core Runtime - 指令虚拟机、表达式系统、运行时上下文

## 简介

`@variojs/core` 是 Vario 的核心运行时模块，提供了框架无关的基础能力：

- **RuntimeContext**: 扁平化状态管理 + `$` 前缀系统 API
- **Expression System**: 安全表达式解析、编译和求值
- **Action VM**: 指令虚拟机，执行各种操作指令
- **安全沙箱**: 多层防护机制，防止恶意代码执行
- **性能优化**: 表达式缓存、对象池、路径记忆化

## 安装

```bash
npm install @variojs/core
# 或
pnpm add @variojs/core
```

## 核心概念

### RuntimeContext 运行时上下文

运行时上下文是 Vario 的核心，提供了扁平化的状态管理和系统 API：

```typescript
import { createRuntimeContext } from '@variojs/core'

const ctx = createRuntimeContext({
  state: {
    count: 0,
    user: { name: 'John', age: 30 }
  },
  methods: {
    increment: (ctx) => {
      ctx._set('count', ctx._get('count') + 1)
    }
  }
})

// 访问状态（扁平化，无 models. 前缀）
ctx.count  // 0
ctx.user.name  // 'John'

// 使用系统 API
ctx._get('count')  // 0
ctx._set('count', 10)  // 设置值
ctx.$emit('countChanged', 10)  // 发射事件
```

### Expression System 表达式系统

安全、强大的表达式求值引擎，支持复杂的条件判断、数据访问和计算：

```typescript
import { createExpressionSandbox, compileExpression } from '@variojs/core'

const sandbox = createExpressionSandbox(ctx)

// 编译表达式
const expr = compileExpression('count > 10 && user.age >= 18')

// 求值
const result = expr.evaluate(sandbox)  // true/false
```

**支持的语法**：
- 变量访问：`count`, `user.name`
- 数组访问：`items[0]`, `todos[index]`
- 可选链：`user?.profile?.email`
- 二元运算：`count + 1`, `price * quantity`
- 比较运算：`count > 10`, `role === "admin"`
- 逻辑运算：`showContent && isActive`
- 三元表达式：`count > 10 ? "high" : "low"`
- 函数调用（白名单）：`Array.isArray(items)`, `Math.max(a, b)`

### Action VM 指令虚拟机

执行各种操作指令，如 `set`、`call`、`if`、`loop` 等：

```typescript
import { createVMExecutor } from '@variojs/core'

const executor = createVMExecutor(ctx)

// 执行 set 指令
await executor.execute({
  type: 'set',
  path: 'count',
  value: 10
})

// 执行 call 指令
await executor.execute({
  type: 'call',
  method: 'increment'
})

// 执行 if 指令
await executor.execute({
  type: 'if',
  cond: 'count > 10',
  then: {
    type: 'set',
    path: 'status',
    value: 'high'
  }
})
```

## API 参考

### createRuntimeContext

创建运行时上下文。

```typescript
function createRuntimeContext<TState extends Record<string, unknown>>(
  options: CreateContextOptions<TState>
): RuntimeContext<TState>
```

**选项**：

```typescript
interface CreateContextOptions<TState> {
  /** 初始状态 */
  state?: TState
  /** 方法注册表 */
  methods?: Record<string, MethodHandler>
  /** 表达式选项 */
  exprOptions?: ExpressionOptions
  /** 事件发射器 */
  onEmit?: (event: string, data?: unknown) => void
  /** 状态变化回调 */
  onStateChange?: (path: string, value: unknown) => void
}
```

### Expression System

```typescript
// 创建表达式沙箱
function createExpressionSandbox(ctx: RuntimeContext): ExpressionSandbox

// 编译表达式
function compileExpression(expr: string): CompiledExpression

// 解析表达式
function parseExpression(expr: string): ExpressionAST

// 求值表达式
function evaluateExpression(expr: string, ctx: RuntimeContext): unknown
```

### Action VM

```typescript
// 创建 VM 执行器
function createVMExecutor(ctx: RuntimeContext): VMExecutor

// 执行动作
function executeAction(action: Action, ctx: RuntimeContext): Promise<void>
```

### Path Utilities

路径解析和操作工具：

```typescript
// 解析路径
function parsePath(path: string): PathSegment[]

// 获取路径值
function getPathValue(obj: Record<string, unknown>, path: string): unknown

// 设置路径值
function setPathValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
  options?: { createObject?: () => object, createArray?: () => unknown[] }
): void

// 路径匹配
function matchPath(pattern: string, path: string): boolean
```

## 安全特性

### 表达式白名单

表达式系统使用白名单机制，只允许安全的操作：

- ✅ 允许：属性访问、数组访问、数学运算、比较运算
- ✅ 允许：白名单函数（`Array.isArray`, `Math.max` 等）
- ❌ 禁止：`eval`, `Function`, `global`, `window` 等危险操作
- ❌ 禁止：直接访问 Node.js API（`require`, `process` 等）

### 沙箱机制

表达式在隔离的沙箱中执行，无法访问外部作用域：

```typescript
const sandbox = createExpressionSandbox(ctx)

// 只能访问 ctx 中定义的状态和方法
// 无法访问全局变量、Node.js API 等
```

## 性能优化

### 表达式缓存

编译后的表达式会被缓存，避免重复编译：

```typescript
// 第一次编译
const expr1 = compileExpression('count > 10')  // 编译

// 第二次使用相同表达式
const expr2 = compileExpression('count > 10')  // 从缓存获取
```

### 路径缓存

路径解析结果会被缓存：

```typescript
parsePathCached('user.profile.name')  // 第一次解析
parsePathCached('user.profile.name')  // 从缓存获取
```

### 对象池

循环上下文使用对象池复用，减少内存分配：

```typescript
import { createLoopContext, releaseLoopContext } from '@variojs/core'

// 创建循环上下文（从池中获取）
const loopCtx = createLoopContext(ctx, { item, index })

// 使用后释放（归还到池中）
releaseLoopContext(loopCtx)
```

## 类型支持

完整的 TypeScript 类型定义：

```typescript
import type {
  RuntimeContext,
  Action,
  ExpressionOptions,
  MethodHandler
} from '@variojs/core'
```

## 示例

查看主项目的 `play/src/examples/` 目录下的完整示例。

## 许可证

MIT
