# 表达式系统

Core 的表达式系统负责**解析、校验并求值**诸如 `count > 10`、`user?.profile?.name` 的字符串表达式，用于 Schema 的 `cond`、`show`、`children` 插值、事件条件等。全程在**沙箱 + 白名单**内执行，不暴露 `eval`/`Function`/全局对象。

## 使用方式

### 直接求值（最常用）

```typescript
import { evaluateExpression, createRuntimeContext } from '@variojs/core'

const ctx = createRuntimeContext({ count: 5, enabled: true })

evaluateExpression('count > 3', ctx)    // true
evaluateExpression('count * 2', ctx)    // 10
evaluateExpression('enabled && count > 0', ctx)  // true
```

第二个参数是 RuntimeContext（或兼容的“上下文视图”），表达式内只能访问该上下文中的状态与白名单里的函数。

### 解析与校验

需要自己拿到 AST 或在校验阶段用时可使用：

```typescript
import { parseExpression, validateAST } from '@variojs/core'

const ast = parseExpression('user.name')
validateAST(ast)  // 抛错表示存在不安全构造
```

白名单外或危险结构会在 `validateAST` 或求值阶段被拒绝。

## 支持的语法（由简到繁）

- **属性访问**：`count`、`user.name`、`list[0]`、`list[i]`
- **可选链**：`user?.profile?.email`
- **二元运算**：`a + b`、`a - b`、`a * b`、`a / b`、`a % b`
- **比较**：`===`、`!==`、`<`、`<=`、`>`、`>=`
- **逻辑**：`&&`、`||`、`!`
- **三元**：`cond ? thenVal : elseVal`
- **函数调用（仅白名单）**：如 `Array.isArray(x)`、`Math.max(a,b)`、`JSON.parse(s)` 等

未在白名单中的函数或成员（如 `eval`、`window`、`require`）不允许使用。

## 依赖收集与缓存

- **extractDependencies**：可从表达式 AST 抽依赖路径（如 `['user.name','count']`），用于做细粒度更新。
- **缓存**：同一表达式字符串多次求值时，Core 会对“编译结果”做缓存，减少重复解析。可用 `getCachedExpression` / `setCachedExpression` / `invalidateCache` / `clearCache` / `getCacheStats` 做调试或定制。

## 选项（exprOptions）

创建上下文或求值时可通过 `exprOptions` 控制：

- **maxSteps**：单次求值最大步数，防 DoS
- **timeout**：超时（毫秒）
- **maxNestingDepth**：最大嵌套深度（默认约 50）
- **allowGlobals**：是否允许访问全局（默认 false，建议保持 false）

这些在 [安全与性能](/packages/core/security-performance) 中会再说明。

## 与 Schema / Vue 的关系

- Schema 里的 `cond`、`show`、`{{ }}` 等字符串都会在渲染层被抽成表达式，再交给 Core 求值。
- Vue 渲染器把当前组件对应的“上下文视图”传进求值函数，因此表达式里写的名字都对应到该视图的状态与方法白名单。

下一步：[Action VM](/packages/core/action-vm) 如何用这些表达式做条件分支与循环。
