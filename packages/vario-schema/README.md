# 📋 @variojs/schema

Vario Schema DSL - Schema 定义、验证、规范化

## 特点

- 🎯 **类型安全**：完整的 TypeScript 类型系统
- ✅ **运行时验证**：确保 Schema 正确性
- 🔧 **自动规范化**：统一格式，优化性能
- 💡 **类型推导**：`defineSchema` 提供完整类型推导

## 安装

```bash
npm install @variojs/schema
# 或
pnpm add @variojs/schema
```

依赖的 `@variojs/core` 会自动安装。

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
        model: 'name'
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
```

## Schema 验证

```typescript
import { validateSchema } from '@variojs/schema'

try {
  validateSchema(schema)
  console.log('Schema 验证通过')
} catch (error) {
  console.error('验证失败:', error.message)
}
```

## 优势

- ✅ **类型推导**：从 `defineSchema` 自动推导状态和服务类型
- ✅ **运行时验证**：结构验证、表达式安全验证、路径验证
- ✅ **性能优化**：规范化结果缓存
- ✅ **易于维护**：统一的 Schema 格式

## 许可证

MIT
