# Schema 工具函数

`@variojs/core` 提供了一套框架无关的 Schema 分析与查询工具，可在任何 JavaScript 环境中使用。

## 核心 API

### analyzeSchema

分析 Schema 树，构建统计信息和索引。

```typescript
function analyzeSchema(
  schema: SchemaNode,
  options?: AnalyzeOptions
): SchemaAnalysis

interface AnalyzeOptions {
  /** 是否构建索引 (默认: true) */
  buildIndex?: boolean
  /** 路径分隔符 (默认: '.') */
  separator?: string
}

interface SchemaAnalysis {
  /** 统计信息 */
  stats: {
    nodeCount: number  // 节点总数
    maxDepth: number   // 最大深度
  }
  /** 索引信息 */
  index: {
    idMap: Map<string, string>        // ID -> 路径
    pathMap: Map<string, SchemaNode>  // 路径 -> 节点
  }
}
```

**示例：**

```typescript
import { analyzeSchema } from '@variojs/core'

const schema = {
  type: 'Form',
  id: 'my-form',
  children: [
    { type: 'Input', id: 'email', props: { label: '邮箱' } },
    { type: 'Input', id: 'password', props: { label: '密码' } }
  ]
}

const analysis = analyzeSchema(schema)
console.log(analysis.stats.nodeCount) // 3
console.log(analysis.index.idMap.get('email')) // 'children.0'
```

### findNodes

查找所有满足条件的节点。

```typescript
function findNodes(
  schema: SchemaNode,
  predicate: (node: SchemaNode, path: string, depth: number) => boolean,
  separator?: string
): Array<{ node: SchemaNode; path: string }>
```

**示例：**

```typescript
import { findNodes } from '@variojs/core'

// 找到所有 Input 类型的节点
const inputs = findNodes(schema, node => node.type === 'Input')
inputs.forEach(({ node, path }) => {
  console.log(`找到 Input: ${path}, label: ${node.props?.label}`)
})

// 找到所有必填字段
const required = findNodes(schema, node => node.required === true)
```

### findNode

查找第一个满足条件的节点（带早停优化）。

```typescript
function findNode(
  schema: SchemaNode,
  predicate: (node: SchemaNode, path: string, depth: number) => boolean,
  separator?: string
): { node: SchemaNode; path: string } | undefined
```

**示例：**

```typescript
import { findNode } from '@variojs/core'

// 找到第一个 Button
const button = findNode(schema, node => node.type === 'Button')
if (button) {
  console.log('找到按钮:', button.path)
}
```

### findPathById

通过 ID 快速查找节点路径（需要预先分析）。

```typescript
function findPathById(
  schema: SchemaNode,
  id: string,
  separator?: string
): string | undefined
```

**示例：**

```typescript
import { findPathById } from '@variojs/core'

const path = findPathById(schema, 'email')
console.log(path) // 'children.0'
```

### createQueryEngine

创建查询引擎，提供优化的查询方法。

```typescript
function createQueryEngine(options: QueryEngineOptions): QueryEngine

interface QueryEngineOptions {
  schema: SchemaNode
  index?: SchemaIndex  // 可选，提供索引可加速查询
}

interface QueryEngine {
  findById(id: string): NodeResult | null
  getParent(path: string): NodeResult | null
}

interface NodeResult {
  node: SchemaNode
  path: string
}
```

**示例：**

```typescript
import { analyzeSchema, createQueryEngine } from '@variojs/core'

// 1. 先分析构建索引
const { index } = analyzeSchema(schema)

// 2. 创建查询引擎
const engine = createQueryEngine({ schema, index })

// 3. 高效查询
const emailNode = engine.findById('email')
if (emailNode) {
  console.log('邮箱输入框路径:', emailNode.path)
  
  // 获取父节点
  const parent = engine.getParent(emailNode.path)
  console.log('父节点类型:', parent?.node.type)
}
```

### traverseSchema

深度优先遍历 Schema 树。

```typescript
function traverseSchema(
  root: SchemaNode,
  callback: (node: SchemaNode, path: string, depth: number) => boolean | void,
  separator?: string
): void
```

**回调返回值：**
- `false`: 停止遍历
- `undefined` 或 `true`: 继续遍历

**示例：**

```typescript
import { traverseSchema } from '@variojs/core'

// 打印所有节点
traverseSchema(schema, (node, path, depth) => {
  const indent = '  '.repeat(depth)
  console.log(`${indent}${node.type} @ ${path}`)
})

// 查找并停止
traverseSchema(schema, (node, path) => {
  if (node.type === 'Button') {
    console.log('找到按钮:', path)
    return false // 停止遍历
  }
})
```

## 性能特性

### 索引构建

`analyzeSchema` 会构建两个索引：

1. **idMap**: ID → 路径的 Map，O(1) 查找
2. **pathMap**: 路径 → 节点的 Map，避免重复遍历

这两个索引在首次分析时一次性构建，后续查询直接使用。

### 早停优化

`findNode` 在找到第一个匹配节点后立即停止遍历，适合只需要单个结果的场景。

### 惰性计算

在 Vue 环境中，`createSchemaAnalyzer` 会自动实现惰性计算：
- 初始化时不遍历
- 首次查询时才构建索引
- 索引缓存，Schema 不变时重复使用
- Schema 变化时标记 dirty，下次查询时重新构建

## 使用场景

### 1. 服务端预处理

```typescript
import { analyzeSchema } from '@variojs/core'

// 服务端分析 Schema 复杂度
app.post('/schema/validate', (req, res) => {
  const schema = req.body.schema
  const { stats } = analyzeSchema(schema)
  
  if (stats.nodeCount > 1000) {
    return res.status(400).json({
      error: 'Schema 过于复杂',
      nodeCount: stats.nodeCount
    })
  }
  
  res.json({ valid: true, stats })
})
```

### 2. CLI 工具

```typescript
import { findNodes } from '@variojs/core'
import fs from 'fs'

// 查找 Schema 中所有使用的组件类型
const schema = JSON.parse(fs.readFileSync('schema.json', 'utf-8'))
const components = new Set<string>()

findNodes(schema, node => {
  components.add(node.type)
  return true
})

console.log('使用的组件:', Array.from(components))
```

### 3. 测试工具

```typescript
import { findNode, analyzeSchema } from '@variojs/core'
import { describe, it, expect } from 'vitest'

describe('Schema 结构测试', () => {
  it('应该包含提交按钮', () => {
    const button = findNode(schema, 
      node => node.type === 'Button' && node.props?.type === 'submit'
    )
    expect(button).toBeDefined()
  })
  
  it('节点数量应在合理范围', () => {
    const { stats } = analyzeSchema(schema)
    expect(stats.nodeCount).toBeLessThan(500)
  })
})
```

## 类型定义

```typescript
import type { SchemaNode } from '@variojs/schema'

// 导出的类型
export interface AnalyzeOptions {
  buildIndex?: boolean
  separator?: string
}

export interface SchemaStats {
  nodeCount: number
  maxDepth: number
}

export interface SchemaIndex {
  idMap: Map<string, string>
  pathMap: Map<string, SchemaNode>
}

export interface SchemaAnalysis {
  stats: SchemaStats
  index: SchemaIndex
}

export interface NodeResult {
  node: SchemaNode
  path: string
}

export interface QueryEngineOptions {
  schema: SchemaNode
  index?: SchemaIndex
}

export interface QueryEngine {
  findById(id: string): NodeResult | null
  getParent(path: string): NodeResult | null
}
```

## 与 Vue 层的关系

| 核心层 (Core) | Vue 层 | 说明 |
|--------------|--------|------|
| `analyzeSchema` | `createSchemaAnalyzer` | Vue 层用 `shallowRef` 包装，添加响应式 |
| `createQueryEngine` | `useSchemaQuery` | Vue 层添加 `patch`、`get` 等便捷方法 |
| `findNodes` | `findAll` | Vue 层返回 NodeWrapper，支持链式操作 |
| `traverseSchema` | - | 底层遍历工具，通常不直接使用 |

在 Vue 环境中，推荐使用 `useVario` 的查询 API；在非 Vue 环境或需要底层控制时，使用核心层 API。

## 相关文档

- [Schema 查询与分析 (Vue)](/guide/schema-query) - Vue 环境使用指南
- [Runtime Context](/packages/core/runtime-context) - 运行时上下文
- [路径工具](/packages/core/path-and-loop) - 路径解析与操作
