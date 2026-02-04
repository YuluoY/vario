# @variojs/types

Vario 框架的 TypeScript 类型定义集合。

## 📦 Purpose

此包提供跨 Vario 包使用的共享类型定义，用于：

- **解决循环依赖**：避免 core、schema、vue 等包之间的循环引用
- **类型复用**：提供统一的类型定义，确保各包类型一致性
- **独立发布**：作为基础类型包，被其他包依赖

## 📖 Installation

```bash
pnpm add @variojs/types
```

## 🚀 Usage

```typescript
// 导入 Schema 相关类型
import type { SchemaNode, ModelModifiers, EventModifiers } from '@variojs/types'

// 导入 Action 类型
import type { Action, ActionMap } from '@variojs/types'

// 导入 Runtime 类型
import type { RuntimeContext, MethodHandler } from '@variojs/types'

// 导入工具类型
import type { PathSegment, GetPathValue } from '@variojs/types'
```

## 📚 Type Categories

### Schema 类型 (schema.ts)

定义 Vario Schema DSL 的核心类型：

- **`SchemaNode<TState>`** - Schema 节点接口，表示组件/元素
- **`Schema<TState>`** - Schema 根节点类型
- **`ModelScopeConfig`** - 双向绑定配置（path、scope、default、lazy、modifiers）
- **`ModelModifiers`** - v-model 修饰符（trim、number、lazy）
- **`EventModifier`** - 事件修饰符（50+ 修饰符：stop、prevent、capture、键盘、系统等）
- **`EventModifiers`** - 事件修饰符集合（数组或对象形式）
- **`CommonEventName`** - 常见 DOM/Vue 事件名（click、input、change、submit、keydown等）
- **`EventName`** - 事件名称（支持点语法：'click.stop.prevent'）
- **`EventHandler`** - 事件处理器（支持多种格式）
- **`EventHandlerArray`** - 事件处理器数组简写
- **`LoopConfig`** - 列表渲染配置
- **`DirectiveObject`** - 指令配置对象
- **`DirectiveArray`** - 指令数组简写
- **`DirectiveConfig`** - 指令配置（支持多种格式）
- **`DefineSchemaConfig<TState, TServices>`** - defineSchema 配置
- **`VarioView<TState>`** - defineSchema 返回值类型

### Action 类型 (action.ts)

定义 Action VM 的指令类型：

- **`Action`** - Action 指令类型（支持类型推导）
- **`ActionType`** - 所有 Action 类型的联合（'call' | 'set' | 'emit' | ...）
- **`ActionMap`** - 所有 Action 类型映射
  - `call` - 调用方法（type 字段会有智能提示）
  - `set` - 设置状态
  - `emit` - 发射事件
  - `log` - 日志输出
  - `condition` - 条件判断
  - `switch` - 多分支
  - `loop` - 循环执行

**类型推导示例：**
```typescript
// ✅ type 字段有智能提示
const action1: Action = { 
  type: 'call',  // 输入时提示：'call' | 'set' | 'emit' | ...
  method: 'handleClick' 
}

// ✅ 根据 type 推导必需属性
const action2: Action = { 
  type: 'set',
  path: 'user.name',  // set 需要 path
  value: 'test'        // set 需要 value
}

// ❌ 缺少必需属性会报错
const error: Action = { 
  type: 'call'  // 错误：缺少 method 属性
}
```

### Runtime 类型 (runtime.ts)

定义运行时上下文和方法类型：

- **`RuntimeContext<TState>`** - 运行时上下文接口
  - `_state` - 响应式状态
  - `_get` / `_set` - 状态读写
  - `_execute` - 执行 Action
  - `_eval` - 表达式求值
  - `$methods` - 方法注册表
  - `$emit` - 事件发射
- **`MethodHandler<TParams, TResult>`** - 方法处理器
- **`ActionHandler`** - Action 处理器
- **`MethodsRegistry`** - 方法注册表
- **`CreateContextOptions<TState>`** - 创建上下文选项

### Expression 类型 (expression.ts)

定义表达式引擎相关类型：

- **`ExpressionOptions`** - 表达式编译选项
- **`ExpressionCache`** - 表达式缓存接口

### Error 类型 (error.ts)

定义错误处理类型：

- **`ErrorContext`** - 错误上下文
- **`SchemaValidationErrorContext`** - Schema 验证错误上下文

### Utils 类型 (utils.ts)

定义工具类型：

- **`PathSegment`** - 路径片段（string | number）
- **`GetPathValue<T, TPath>`** - 获取路径值的类型推导
- **`SetPathValue<T, TPath>`** - 设置路径值的类型推导
- **`OnStateChangeCallback<TState>`** - 状态变更回调
- **`InferStateType<TSchema>`** - 从 Schema 推导状态类型
- **`InferStateFromConfig<TConfig>`** - 从配置推导状态类型
- **`InferServicesFromConfig<TConfig>`** - 从配置推导服务类型

## 🎯 Type Examples

### ModelModifiers 示例

```typescript
import type { ModelModifiers } from '@variojs/types'

// 数组形式
const modifiers1: ModelModifiers = ['trim', 'number']

// 对象形式
const modifiers2: ModelModifiers = { trim: true, lazy: true }

// 自定义修饰符
const modifiers3: ModelModifiers = ['trim', 'custom']
```

### EventModifiers 示例

```typescript
import type { EventModifiers, EventModifier } from '@variojs/types'

// 数组形式
const mods1: EventModifiers = ['stop', 'prevent']

// 对象形式
const mods2: EventModifiers = { stop: true, prevent: true }

// 键盘 + 系统修饰符
const mods3: EventModifiers = ['enter', 'ctrl']
```

### SchemaNode 示例

```typescript
import type { SchemaNode } from '@variojs/types'

const loginForm: SchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: {
        path: 'username',
        modifiers: ['trim']
      },
      props: { placeholder: '用户名' }
    },
    {
      type: 'button',
      events: {
        'click.prevent': { type: 'call', method: 'handleSubmit' }
      },
      children: '登录'
    }
  ]
}
```

## 🔗 Related Packages

- **[@variojs/core](../vario-core)** - 核心运行时（依赖此包）
- **[@variojs/schema](../vario-schema)** - Schema 工具（依赖此包）
- **[@variojs/vue](../vario-vue)** - Vue 渲染器（依赖此包）

## 📄 License

MIT
