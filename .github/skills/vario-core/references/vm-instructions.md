# VM Instructions — Deep Reference

> 读取时机：需要理解 Action VM 指令的详细行为、参数解析、错误传播、超时机制时读取。

## Table of Contents
1. [执行器架构](#执行器架构)
2. [指令参数的表达式求值](#指令参数的表达式求值)
3. [原子指令详解](#原子指令详解)
4. [控制流指令详解](#控制流指令详解)
5. [数组操作指令详解](#数组操作指令详解)
6. [超时与步数限制](#超时与步数限制)
7. [错误传播](#错误传播)

---

## 执行器架构

`execute(actions, ctx, options?)` 是唯一入口：

```typescript
async function execute(
  actions: ActionInstruction | ActionInstruction[],
  ctx: RuntimeContext,
  options?: { timeout?: number; maxSteps?: number }
): Promise<void>
```

- 单条 Action 自动包装为数组
- 顺序执行（非并行），前一条完成后才执行下一条
- 每条 Action 根据 `type` 字段派发到对应 handler

### Handler 注册

13 个内置 handler，每个对应一个 `type` 值。handler 签名：

```typescript
type ActionHandler = (action: ActionInstruction, ctx: RuntimeContext) => Promise<void> | void
```

---

## 指令参数的表达式求值

所有指令的**字符串类型值字段**都会经过表达式求值：

```json
{ "type": "set", "path": "name", "value": "{{ user.firstName + ' ' + user.lastName }}" }
```

**求值规则：**
- 字符串值包含 `{{ }}` → 提取内部表达式并求值
- 纯字符串且为简单路径格式 → 视为表达式尝试求值
- 非字符串值 → 直接使用
- `params` 对象中的每个值独立求值

---

## 原子指令详解

### set

```typescript
{ type: 'set', path: string, value: any }
```

- `path`：状态路径，通过 `ctx._set(path, resolvedValue)` 写入
- `value`：字符串时作为表达式求值，其他类型直接使用
- 触发 `onStateChange` 回调

### emit

```typescript
{ type: 'emit', event: string, data?: any }
```

- 调用 `ctx.$emit(event, data)`
- `data` 中的字符串值经过表达式求值

### navigate

```typescript
{ type: 'navigate', to: string, replace?: boolean }
```

- 由集成层（Vue Router 等）提供实际导航实现
- `to` 支持表达式：`"{{ '/user/' + userId }}"`
- `replace: true` 时使用 replaceState 而非 pushState

### log

```typescript
{ type: 'log', message: string | any, level?: 'info' | 'warn' | 'error' }
```

- `message` 经过表达式求值
- 默认 level: `'info'`
- 输出到 `console[level]`

---

## 控制流指令详解

### call

```typescript
{
  type: 'call',
  method: string,
  params?: Record<string, any> | any[],
  resultTo?: string
}
```

- 从 `ctx.$methods[method]` 获取函数并调用
- `params` 对象中每个字符串值独立求值
- `params` 为数组时按位置传参
- `resultTo`：若指定，将返回值写入 `ctx._set(resultTo, result)`
- 方法不存在 → 抛出 `ActionError`

### if

```typescript
{
  type: 'if',
  cond: string,
  then: ActionInstruction[],
  else?: ActionInstruction[]
}
```

- `cond` 作为表达式求值
- truthy → 递归执行 `then` 数组
- falsy → 递归执行 `else` 数组（如果存在）
- 支持嵌套 if

### loop

```typescript
{
  type: 'loop',
  var: string,
  in: string,
  body: ActionInstruction[]
}
```

- `in` 求值为可迭代对象（数组）
- 每次迭代：
  1. `createLoopContext(ctx, item, index)` 创建循环上下文
  2. `loopCtx.$item = item`, `loopCtx.$index = index`
  3. 如果 `var` 指定，`loopCtx[var] = item`
  4. 递归执行 `body`
  5. `releaseLoopContext(loopCtx)` 归还池

### batch

```typescript
{
  type: 'batch',
  actions: ActionInstruction[]
}
```

- 顺序执行所有 actions
- 某条失败时**继续执行后续**，错误收集到 `BatchError`
- 全部执行完后，如有错误抛出 `BatchError`（包含所有错误）

---

## 数组操作指令详解

所有数组操作对 `ctx._get(path)` 获取的数组执行，修改后通过 `ctx._set(path, newArray)` 写回。

### push

```typescript
{ type: 'push', path: string, value: any }
```

在数组末尾添加元素。`value` 经过表达式求值。

### pop

```typescript
{ type: 'pop', path: string }
```

移除并返回数组最后一个元素。

### shift / unshift

```typescript
{ type: 'shift', path: string }
{ type: 'unshift', path: string, value: any }
```

从头部移除 / 在头部添加。

### splice

```typescript
{
  type: 'splice',
  path: string,
  start: number,
  deleteCount?: number,
  items?: any[]
}
```

通用数组修改。`items` 中的字符串值经过表达式求值。

---

## 超时与步数限制

```typescript
await execute(actions, ctx, {
  timeout: 5000,     // 毫秒，总执行时间限制
  maxSteps: 10000    // 最大指令执行步数（含递归）
})
```

- 每执行一条 Action，步数 +1（嵌套的 if/loop/batch 内的每条也计数）
- 超出 `maxSteps` → 抛出 `ActionError('Maximum steps exceeded')`
- 超出 `timeout` → 抛出 `ActionError('Execution timeout')`
- 两者独立检查，任一触发即终止

---

## 错误传播

| 场景 | 错误类型 | 行为 |
|------|----------|------|
| 方法不存在 | `ActionError` | 立即终止 |
| 表达式求值失败 | `ExpressionError` → 包装为 `ActionError` | 立即终止 |
| 路径不存在 | 静默忽略（get 返回 undefined, set 自动建链） | 继续执行 |
| batch 中某条失败 | 收集到 `BatchError` | 继续执行后续 |
| 超时/步数超限 | `ActionError` | 立即终止整个执行链 |
| 未知 type | `ActionError('Unknown action type')` | 立即终止 |
