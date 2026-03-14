# Schema Query & Node Context — Deep Reference

> 读取时机：用户使用 schema 查询 API（find/findAll/findById）、节点上下文（$self/$parent/$siblings）、或需要动态修改 schema 时读取。

## Table of Contents
1. [Schema Query API (useSchemaQuery)](#schema-query-api)
2. [NodeWrapper](#nodewrapper)
3. [SchemaAnalyzer](#schemaanalyzer)
4. [Node Context（节点上下文）](#node-context)
5. [Proxy 链式访问机制](#proxy-链式访问机制)

---

## Schema Query API

源码：`packages/vario-vue/src/composables/useSchemaQuery.ts`

`useVario` 返回的 `query` 对象即为 `SchemaQueryApi`。

### 接口
```typescript
interface SchemaQueryApi {
  find(predicate: (node: SchemaNode) => boolean): NodeWrapper | null
  findAll(predicate: (node: SchemaNode) => boolean): NodeWrapper[]
  findById(id: string): NodeWrapper | null
}
```

### 使用示例
```typescript
const { query } = useVario(schema, state)

// 按条件查找第一个
const emailField = query.find(n => n.props?.type === 'email')

// 查找所有
const allInputs = query.findAll(n => n.type === 'ElInput')

// 按 ID 查找（schema 节点需有 id 属性）
const submitBtn = query.findById('submit-button')
```

### 实现流程
```
find(predicate)
  → analyzer.findPaths(predicate)   // 遍历 schema 树找匹配路径
  → paths[0]                        // 取第一个
  → getPathValue(root, path)        // @variojs/core 按路径取值
  → createWrapper(path, node)       // 包装为 NodeWrapper

findById(id)
  → analyzer.getPathById(id)        // 从 idMap 直接查找路径
  → getPathValue(root, path)
  → createWrapper(path, node)
```

---

## NodeWrapper

查询结果的包装对象，提供便捷的节点操作 API。

```typescript
interface NodeWrapper {
  path: string                              // 节点路径 "root.0.1"
  node: SchemaNode                          // 原始节点对象（响应式）
  patch(partial: Partial<SchemaNode>): void // 局部修改
  get(key: string): any                     // 读取属性
  parent(): NodeWrapper | null              // 获取父节点
}
```

### patch — 局部修改节点
```typescript
const btn = query.findById('submit')
btn?.patch({ 
  props: { ...btn.node.props, disabled: true } 
})
```
内部调用 `options.patchNode(path, partial)` → 通过 `useVario` 关联的 `patchNode` 方法更新 schema。

### parent — 链式父级访问
```typescript
const node = query.find(n => n.type === 'ElInput')
const parentNode = node?.parent()          // 父节点 NodeWrapper
const grandParent = parentNode?.parent()   // 祖父节点
```
内部通过 `@variojs/core` 的 `createQueryEngine({ schema }).getParent(path)` 实现。

---

## SchemaAnalyzer

源码：`packages/vario-vue/src/features/schema-analyzer.ts`

Vue 响应式版本的 Schema 分析器，基于 `@variojs/core` 的纯函数 `analyzeSchema`/`findNodes`。

### 接口
```typescript
interface SchemaAnalyzer {
  stats: ShallowRef<SchemaStats>  // { nodeCount, maxDepth }
  getPathById(id: string): string | undefined
  findPaths(predicate: (node: SchemaNode) => boolean): string[]
  refresh(): void                  // 强制重新分析
}
```

### 惰性分析机制
- 默认 `lazy: true` — 仅在首次调用 `getPathById`/`findPaths` 时执行遍历
- `isDirty` 标记 + `ensureFresh()` 延迟求值
- 监听 `schemaRef` 变化（`watch(..., { deep: true })`），标记 dirty

### 创建方式
```typescript
const analyzer = createSchemaAnalyzer(schemaRef, {
  lazy: true,       // 默认值
  onAnalyze: (node, path, depth) => { /* 自定义回调 */ }
})
```

---

## Node Context

源码：`packages/vario-vue/src/features/node-context.ts`

在事件处理器和 Action VM 执行时，通过 `ctx` 访问当前节点的树关系。

### 注入的上下文变量

| 变量 | 类型 | 说明 |
|------|------|------|
| `$self` | `SchemaNode (Proxy)` | 当前节点，支持 `.parent` 链式访问 |
| `$parent` | `SchemaNode (Proxy) \| null` | 父节点 |
| `$siblings` | `SchemaNode[]` | 同层兄弟节点（不含自身） |
| `$children` | `SchemaNode[] \| undefined` | 当前节点的子节点 |

### NodeContext 数据结构
```typescript
interface NodeContext {
  parent?: SchemaNode       // 父节点 schema
  siblings?: SchemaNode[]   // 兄弟节点数组（含自身）
  selfIndex?: number        // 自身在兄弟中的索引
  path?: string             // 节点路径
}
```

### nodeContext 的创建时机
在 `ChildrenResolver.resolveChildren` 中，遍历子节点数组时为每个子节点构建：
```typescript
{
  parent: schema,           // 父节点 = 当前正在解析的节点
  siblings: children,       // 兄弟 = children 数组
  selfIndex: i,             // 索引
  path: childPath           // 路径
}
```

### 使用示例
```json
{
  "type": "ElButton",
  "events": {
    "click": {
      "actions": [{
        "type": "call",
        "method": "handleClick"
      }]
    }
  }
}
```

```typescript
// 在 methods 中
function handleClick({ ctx }: MethodContext) {
  console.log(ctx.$self)       // 当前 ElButton 节点
  console.log(ctx.$parent)     // 父节点
  console.log(ctx.$siblings)   // 兄弟节点（不含自身）
  console.log(ctx.$self.parent) // 也可以这样访问父节点（Proxy）
}
```

---

## Proxy 链式访问机制

使用 `Proxy + WeakMap` 实现 `$self.parent.parent...` 的无限链式访问。

### ParentMap
```typescript
type ParentMap = WeakMap<SchemaNode, SchemaNode | null>
```
在渲染过程中维护，每次 `resolveChildren` 时注册 `parentMap.set(child, parent)`。

### createNodeProxy
```typescript
function createNodeProxy(node: SchemaNode, parentMap: ParentMap): SchemaNode | null {
  return new Proxy(node, {
    get(target, prop) {
      if (prop === 'parent' || prop === '$parent') {
        const p = parentMap.get(target)
        return createNodeProxy(p, parentMap)   // 递归代理，支持链式
      }
      return target[prop]                       // 其余属性直接转发
    },
    set(target, prop, value) {
      if (prop === 'parent' || prop === '$parent') return false  // parent 只读
      target[prop] = value
      return true
    }
  })
}
```

### applyNodeContextToCtx
将节点上下文注入到运行时 `ctx`：
```typescript
function applyNodeContextToCtx(ctx, schema, nodeContext, parentMap) {
  ctx.$self     = createNodeProxy(schema, parentMap)
  ctx.$parent   = createNodeProxy(nodeContext?.parent, parentMap)
  ctx.$siblings = siblings.filter((_, i) => i !== selfIndex)
                          .map(s => createNodeProxy(s, parentMap))
  ctx.$children = Array.isArray(schema.children) ? schema.children : undefined
}
```

### 关键设计
- **WeakMap** 不阻止 GC，schema 节点被回收后映射自动清理
- **Proxy 惰性创建**：只在访问 `.parent` 时才递归创建代理
- **只读保护**：`parent`/`$parent` 属性不可写入
- **$siblings 排除自身**：过滤掉 `selfIndex` 位置的节点
