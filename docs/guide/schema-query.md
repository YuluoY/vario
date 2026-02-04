# Schema 查询与分析

Vario 提供了强大的 Schema 查询与分析能力，允许开发者使用类似 jQuery 的链式 API 来查找和操作 Schema 节点，而无需关心具体的层级路径。

## 架构设计

Vario 的 Schema 查询功能采用**分层架构**，实现了框架无关的核心逻辑与 Vue 特定集成的分离：

```
┌─────────────────────────────────────────┐
│  @variojs/vue (Vue 响应式层)              │
│  - useSchemaQuery (Composition API)     │
│  - createSchemaAnalyzer (响应式包装)     │
└──────────────┬──────────────────────────┘
               │ 使用
┌──────────────▼──────────────────────────┐
│  @variojs/core (框架无关核心)            │
│  - analyzeSchema (纯函数)               │
│  - createQueryEngine (查询引擎)         │
│  - traverseSchema (遍历工具)            │
└─────────────────────────────────────────┘
```

### 核心层 (@variojs/core)
- **纯函数设计**：所有分析逻辑都是纯函数，可在任何 JavaScript 环境使用
- **高性能**：使用 Map 索引实现 O(1) ID 查找
- **可复用**：可用于 React、Angular 等其他框架

### Vue 层 (@variojs/vue)
- **响应式包装**：使用 `shallowRef` 和 `watch` 包装核心功能
- **自动更新**：Schema 变化时自动重新分析
- **便捷 API**：提供 `useSchemaQuery` 等 Composition API

## 核心特性

- **jQuery 风格 API**：`find`, `findAll`, `findById` 等直观方法
- **智能分析 (SchemaAnalyzer)**：
  - 自动统计节点数量和深度
  - 建立 ID 索引，实现 O(1) 查找
  - **惰性计算**：只在需要时才遍历 Schema，且支持缓存，避免重复计算
- **响应式集成**：查询结果可以直接用于 Vue 模板，修改操作自动触发视图更新
- **框架无关核心**：核心查询逻辑可在任何 JavaScript 环境复用

## 基础用法

### 1. 初始化

`useVario` 默认集成了查询功能，可以直接解构使用：

```typescript
import { useVario } from '@variojs/vue'

const { 
  state, 
  // 查询 API
  find, 
  findAll, 
  findById,
  // 统计信息
  stats 
} = useVario(schema)
```

### 2. 通过 ID 查找 (findById)

这是最常用且最高效的方式（基于 Map 索引）。

Schema 定义：
```javascript
{
  type: 'Container',
  children: [
    { type: 'Input', id: 'user-email', props: { label: '邮箱' } }
  ]
}
```

代码用法：
```typescript
const emailNode = findById('user-email')

if (emailNode) {
  // 读取属性
  console.log(emailNode.get('props').label) // '邮箱'
  
  // 修改属性 (自动触发更新)
  emailNode.patch({ 
    props: {
      label: '企业邮箱',
      disabled: true
    }
  })
}
```

### 3. 条件查找 (find / findAll)

查找满足特定条件的节点。

```typescript
// 找到第一个类型为 number 的节点
const numberField = find(node => node.type === 'number')

// 找到所有必填项
const requiredFields = findAll(node => node.required === true)

// 批量操作
requiredFields.forEach(wrapper => {
  wrapper.patch({ class: 'highlight-required' })
})
```

## NodeWrapper API

查询返回的对象是 `NodeWrapper`，提供以下方法：

| 方法 | 描述 |
| --- | --- |
| `path` | 获取当前节点的绝对路径字符串 (如 `properties.user.properties.name`) |
| `node` | 获取原始 Schema 节点对象 (Reactive) |
| `get(key)` | 获取节点属性值 |
| `patch(data)` | 增量修改节点数据 |
| `parent()` | 获取父节点的包装器 |

## 性能与原理

### 单次遍历 (Single Pass Analysis)

为了性能最大化，Vario 内部使用了 `SchemaAnalyzer`。它保证：

1. **惰性**：初始化 `useVario` 时**不会**立即遍历 Schema。只有当你首次调用 `findById` 或访问 `stats` 时，才会触发遍历。
2. **缓存**：遍历结果（索引和统计）会缓存。只有当 Schema 结构发生变化（dirty）且再次请求数据时，才会重新计算。
3. **共享**：同一个 analyzer 实例被所有查询 API 共享，避免重复遍历。

### 统计信息

你可以实时获取 Schema 的复杂度信息：

```typescript
watchEffect(() => {
  console.log('节点总数:', stats.value.nodeCount)
  console.log('最大深度:', stats.value.maxDepth)
})
```

## 跨框架使用

如果你在非 Vue 环境（如 React、Node.js）中使用 Vario，可以直接使用核心层 API：

```typescript
import { analyzeSchema, createQueryEngine } from '@variojs/core'

// 1. 分析 Schema
const { stats, index } = analyzeSchema(schema)
console.log('节点总数:', stats.nodeCount)
console.log('最大深度:', stats.maxDepth)

// 2. 创建查询引擎
const engine = createQueryEngine({ schema, index })

// 3. 查询节点
const result = engine.findById('user-email')
if (result) {
  console.log('找到节点:', result.node.type)
  console.log('节点路径:', result.path)
  
  // 获取父节点
  const parent = engine.getParent(result.path)
  if (parent) {
    console.log('父节点类型:', parent.node.type)
  }
}
```

## 最佳实践

1. **优先使用 ID**：给关键业务字段设置唯一的 `id` 属性，这是最健壮的引用方式，不受层级调整影响
2. **批量操作**：利用 `findAll` 可以轻松实现"将所有输入框设为只读"等批量逻辑
3. **避免直接修改 path**：尽量使用 `wrapper.patch()` 而不是手动拼接 path 字符串调用 `patchNode`
4. **框架无关场景**：如需在非 Vue 环境使用，直接导入 `@variojs/core` 的纯函数 API
5. **性能优化**：首次查询会触发遍历和索引构建，后续查询直接使用缓存的索引

## 相关文档

- [Core Schema API](/packages/core/api#schema-utilities) - 核心层 Schema 查询 API
- [Vue useVario API](/api/use-vario) - Vue 集成完整 API
- [性能优化指南](/guide/performance) - Schema 查询性能优化建议
