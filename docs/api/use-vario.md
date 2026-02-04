# useVario

```typescript
function useVario<TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
  options?: UseVarioOptions<TState>
): UseVarioResult<TState>
```

## Options

```typescript
interface UseVarioOptions<TState> {
  /** 初始状态（会自动包裹为响应式对象） */
  state?: TState
  
  /** 计算属性（传入 Vue ComputedRef） */
  computed?: Record<string, ((state: TState) => any) | ComputedRef<any>>
  
  /** 方法定义 */
  methods?: Record<string, (context: MethodContext<TState>) => any>
  
  /** 表达式选项 */
  exprOptions?: ExpressionOptions
  
  /** 自定义 model 绑定配置 */
  modelBindings?: Record<string, ModelConfig>
  
  /** Model 绑定配置：separator 路径分隔符；lazy 整棵 schema 的 model 默认惰性 */
  modelOptions?: {
    separator?: string  // 默认 '.'
    lazy?: boolean       // true 时所有未显式设置 lazy 的 model 均不预写 state
  }
  
  /** 渲染器选项 */
  rendererOptions?: VueRendererOptions
  
  /** 错误边界配置 */
  errorBoundary?: {
    enabled?: boolean
    fallback?: (error: Error) => VNode
  }
  
  /** 事件发射器 */
  onEmit?: (event: string, data?: unknown) => void
}
```

## 返回值

```typescript
interface UseVarioResult<TState> {
  /** 渲染的 VNode */
  vnode: Ref<VNode | null>
  
  /** 响应式状态（自动包裹） */
  state: TState
  
  /** 运行时上下文 */
  ctx: Ref<RuntimeContext<TState>>
  
  /** 模板引用集合 */
  refs: Record<string, Ref<any>>
  
  /** 当前错误（如果有） */
  error: Ref<Error | null>
  
  /** Schema 统计信息（惰性计算） */
  stats: Ref<{
    nodeCount: number  // 节点总数
    maxDepth: number   // 最大深度
  }>
  
  /** 手动触发重新渲染 */
  retry: () => void
  
  // === Schema 查询 API ===
  
  /** 查找第一个匹配的节点 */
  find: (predicate: (node: SchemaNode) => boolean) => NodeWrapper | null
  
  /** 查找所有匹配的节点 */
  findAll: (predicate: (node: SchemaNode) => boolean) => NodeWrapper[]
  
  /** 通过 ID 查找节点（O(1) 索引查找） */
  findById: (id: string) => NodeWrapper | null
}

interface NodeWrapper {
  /** 节点路径 */
  path: string
  
  /** 节点对象（响应式） */
  node: SchemaNode
  
  /** 修改节点属性 */
  patch: (partial: Partial<SchemaNode>) => void
  
  /** 获取节点属性 */
  get: (key: string) => any
  
  /** 获取父节点包装器 */
  parent: () => NodeWrapper | null
}
```
## 使用示例

### 基础渲染

```typescript
import { useVario } from '@variojs/vue'

const schema = {
  type: 'div',
  children: [
    {
      type: 'el-button',
      id: 'submit-btn',
      props: { type: 'primary' },
      children: '提交'
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: { count: 0 }
})
```

### Schema 查询

```typescript
const { findById, find, findAll, stats } = useVario(schema, {
  state: { /* ... */ }
})

// 通过 ID 查找（最快）
const submitBtn = findById('submit-btn')
if (submitBtn) {
  submitBtn.patch({ props: { disabled: true } })
}

// 条件查找
const firstInput = find(node => node.type === 'el-input')

// 查找所有匹配节点
const allButtons = findAll(node => node.type === 'el-button')
allButtons.forEach(btn => {
  btn.patch({ props: { size: 'small' } })
})

// 获取统计信息
watchEffect(() => {
  console.log(`节点数: ${stats.value.nodeCount}`)
  console.log(`深度: ${stats.value.maxDepth}`)
})
```

### 节点操作

```typescript
const node = findById('my-input')
if (node) {
  // 读取属性
  console.log(node.path)  // 'children.0.children.1'
  console.log(node.get('props').placeholder)
  
  // 修改属性
  node.patch({
    props: {
      placeholder: '新的提示文本',
      disabled: false
    }
  })
  
  // 获取父节点
  const parent = node.parent()
  if (parent) {
    console.log('父节点类型:', parent.node.type)
  }
}
```

## 相关文档

- [Schema 查询指南](/guide/schema-query) - 完整的查询功能说明
- [Core Schema API](/packages/core/schema-utilities) - 框架无关的核心 API
- [类型定义](/api/types) - 完整的 TypeScript 类型