# @variojs/schema

Vario Schema DSL - Schema 定义、验证、规范化、转换

## 简介

`@variojs/schema` 提供了 Vario Schema DSL 的完整支持：

- **Schema 类型定义**：完整的 TypeScript 类型系统
- **Schema 验证器**：运行时验证，确保 Schema 的正确性
- **Schema 规范化器**：统一 Schema 格式，优化渲染性能
- **defineSchema API**：TypeScript 原生 API，提供类型推导

## 安装

```bash
npm install @variojs/schema @variojs/core
# 或
pnpm add @variojs/schema @variojs/core
```

## 快速开始

### 基础 Schema

```typescript
import type { SchemaNode } from '@variojs/schema'

const schema: SchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'name',
      props: { placeholder: '请输入姓名' }
    },
    {
      type: 'div',
      children: '{{ name }}'
    }
  ]
}
```

### 使用 defineSchema（推荐）

`defineSchema` 提供完整的类型推导和验证：

```typescript
import { defineSchema } from '@variojs/schema'

const view = defineSchema({
  state: {
    name: '',
    count: 0
  },
  services: {
    increment: (ctx) => {
      ctx._set('count', ctx._get('count') + 1)
    }
  },
  schema: (ctx) => ({
    type: 'div',
    children: [
      {
        type: 'input',
        model: 'name',
        props: { placeholder: '姓名' }
      },
      {
        type: 'button',
        events: {
          click: {
            type: 'call',
            method: 'increment'
          }
        },
        children: '计数: {{ count }}'
      }
    ]
  })
})

// view.schema - 规范化后的 Schema
// view.stateType - 状态类型（用于类型推导）
// view.servicesType - 服务类型（用于类型推导）
```

## 核心功能

### Schema 验证

运行时验证 Schema 的正确性：

```typescript
import { validateSchema, SchemaValidationError } from '@variojs/schema'

try {
  validateSchema(schema)
  console.log('Schema 验证通过')
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error('验证失败:', error.path, error.message)
  }
}
```

**验证内容**：
- 结构验证（必需字段、类型检查）
- 表达式安全验证（使用 `@variojs/core` 的表达式系统）
- 路径验证（`model`, `loop.items` 等）
- 递归校验所有子节点

### Schema 规范化

统一 Schema 格式，优化渲染性能：

```typescript
import { normalizeSchema } from '@variojs/schema'

const normalized = normalizeSchema(schema)
```

**规范化内容**：
- 统一属性格式
- 优化表达式格式
- 合并重复配置
- 缓存规范化结果

### 类型推导

完整的 TypeScript 类型支持：

```typescript
import type {
  SchemaNode,
  Schema,
  LoopConfig,
  InferStateType,
  InferServicesFromConfig
} from '@variojs/schema'

// 从 defineSchema 推导状态类型
type State = InferStateType<typeof view>

// 从 defineSchema 推导服务类型
type Services = InferServicesFromConfig<typeof view>
```

## Schema DSL 参考

### 基础属性

```typescript
interface SchemaNode {
  /** 组件类型或 HTML 标签名 */
  type: string
  
  /** 组件属性（支持表达式插值） */
  props?: Record<string, unknown>
  
  /** 子节点 */
  children?: SchemaNode[] | string
  
  /** 事件处理器 */
  events?: Record<string, Action[]>
}
```

### 条件渲染

```typescript
{
  type: 'div',
  cond: 'user.age >= 18',  // 条件渲染（v-if）
  // 或
  show: 'isVisible',        // 条件显示（v-show）
  children: 'Content'
}
```

### 循环渲染

```typescript
{
  type: 'div',
  loop: {
    items: '{{ userList }}',  // 数据源表达式
    itemKey: 'item',          // 项变量名
    indexKey: 'index'         // 索引变量名（可选）
  },
  children: [
    {
      type: 'div',
      children: '{{ index + 1 }}. {{ item.name }}'
    }
  ]
}
```

### 双向绑定

```typescript
{
  type: 'input',
  model: 'user.name',  // 双向绑定路径
  props: { placeholder: '姓名' }
}
```

### 表达式插值

支持 `{{ }}` 表达式语法：

```typescript
{
  type: 'div',
  children: '{{ firstName + " " + lastName }}',  // 字符串拼接
  props: {
    disabled: '{{ count === 0 }}'  // 布尔表达式
  }
}
```

## API 参考

### defineSchema

定义 Schema，提供类型推导和验证。

```typescript
function defineSchema<TState, TServices>(
  config: DefineSchemaConfig<TState, TServices>
): VarioView<TState>
```

**配置选项**：

```typescript
interface DefineSchemaConfig<TState, TServices> {
  /** 状态类型定义 */
  state: TState
  /** 服务方法定义 */
  services?: TServices
  /** Schema 函数 */
  schema: (ctx: RuntimeContext<TState>) => Schema<TState>
}
```

### validateSchema

验证 Schema 的正确性。

```typescript
function validateSchema(schema: Schema): void
// 抛出 SchemaValidationError 如果验证失败
```

### normalizeSchema

规范化 Schema。

```typescript
function normalizeSchema(schema: Schema): Schema
```

### 类型工具

```typescript
// 从 defineSchema 结果推导状态类型
type InferStateType<T> = ...

// 从 defineSchema 配置推导状态类型
type InferStateFromConfig<T> = ...

// 从 defineSchema 配置推导服务类型
type InferServicesFromConfig<T> = ...
```

## 错误处理

### SchemaValidationError

Schema 验证错误：

```typescript
class SchemaValidationError extends Error {
  path: string        // 错误路径
  message: string      // 错误消息
  context?: {          // 错误上下文
    node?: SchemaNode
    suggestion?: string
  }
}
```

### DefineSchemaConfigError

`defineSchema` 配置错误：

```typescript
class DefineSchemaConfigError extends Error {
  field: string  // 错误字段
}
```

## 最佳实践

1. **使用 `defineSchema`**：提供类型推导和自动验证
2. **类型安全**：充分利用 TypeScript 类型系统
3. **表达式安全**：只使用白名单函数和操作
4. **路径规范**：使用明确的路径，避免歧义
5. **性能优化**：规范化后的 Schema 会被缓存

## 示例

查看主项目的 `play/src/examples/` 目录下的完整示例。

## 许可证

MIT
