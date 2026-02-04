# @vario/vue 类型定义

本文档详细说明 @vario/vue 包的所有类型定义。

## 核心类型

### VueSchemaNode

扩展的 Schema 节点类型，包含 Vue 特定属性。

```typescript
interface VueSchemaNode extends SchemaNode {
  // Vue 模板引用
  ref?: string
  
  // Vue Provide/Inject
  provide?: Record<string, any>
  inject?: string[] | Record<string, InjectConfig>
  
  // Vue Teleport
  teleport?: string | boolean
  
  // Vue Transition
  transition?: string | TransitionProps
  
  // Vue KeepAlive
  keepAlive?: boolean | KeepAliveProps
  
  // 生命周期钩子（方法名）
  onBeforeMount?: string
  onMounted?: string
  onBeforeUpdate?: string
  onUpdated?: string
  onBeforeUnmount?: string
  onUnmounted?: string
}
```

### UseVarioOptions

`useVario` 的配置选项。

```typescript
interface UseVarioOptions<TState extends Record<string, unknown> = Record<string, unknown>> {
  // 初始状态（会自动包裹为响应式对象）
  state?: TState
  
  // 计算属性（Options 或 Composition 风格）
  computed?: Record<string, ((state: TState) => any) | ComputedRef<any>>
  
  // 方法（统一注册到 $methods）
  methods?: Record<string, (ctx: MethodContext<TState>) => any>
  
  // 双向绑定配置（非标准组件）
  modelBindings?: Record<string, any>
  
  // 事件处理
  onEmit?: (event: string, data?: unknown) => void
  
  // 错误处理
  onError?: (error: Error) => void
  
  // 错误边界配置
  errorBoundary?: ErrorBoundaryConfig
  
  // 渲染器配置
  rendererOptions?: VueRendererOptions
  
  // Vue 应用实例
  app?: App | null
  
  // 全局组件映射
  components?: Record<string, any>
  
  // 表达式求值配置
  exprOptions?: ExpressionOptions
  
  // Model 绑定配置
  modelOptions?: ModelOptions
}
```

### UseVarioResult

`useVario` 的返回值。

```typescript
interface UseVarioResult<TState extends Record<string, unknown>> extends SchemaQueryApi {
  // 渲染的 VNode
  vnode: Ref<VNode | null>
  
  // 响应式状态对象
  state: TState
  
  // 运行时上下文
  ctx: Ref<RuntimeContext<TState>>
  
  // 模板引用集合
  refs: Record<string, Ref<any>>
  
  // 当前错误（如果有）
  error: Ref<Error | null>
  
  // Schema 统计信息
  stats: Ref<SchemaStats>
  
  // 手动触发重新渲染（用于错误恢复）
  retry: () => void
  
  // Schema 查询方法
  findById: (id: string) => NodeWrapper | null
  findByType: (type: string) => NodeWrapper[]
  findAll: (predicate: (node: SchemaNode) => boolean) => NodeWrapper[]
}
```

### MethodContext

方法执行的上下文。

```typescript
interface MethodContext<TState extends Record<string, unknown> = Record<string, unknown>> {
  // 响应式状态
  state: TState
  
  // 方法参数
  params: any
  
  // 触发的事件对象（如果有）
  event?: Event
  
  // 底层运行时上下文
  ctx: RuntimeContext<TState>
}
```

## 渲染器类型

### VueRendererOptions

Vue 渲染器的配置选项。

```typescript
interface VueRendererOptions {
  // 组件实例
  instance?: ComponentInternalInstance | null
  
  // Vue 应用实例
  app?: App | null
  
  // 全局组件映射
  components?: Record<string, any>
  
  // 自定义指令映射
  directives?: Record<string, Directive>
  
  // 获取响应式状态
  getState?: () => any
  
  // Refs 注册表
  refsRegistry?: RefsRegistry
  
  // Model 绑定配置
  modelOptions?: ModelOptions
  
  // 启用 path-memo 缓存（默认 true）
  usePathMemo?: boolean
  
  // 列表项组件化（默认 false）
  loopItemAsComponent?: boolean
  
  // 子树组件化配置
  subtreeComponent?: SubtreeComponentConfig
  
  // Schema 碎片化配置
  schemaFragment?: SchemaFragmentConfig
}
```

### SubtreeComponentConfig

子树组件化配置。

```typescript
interface SubtreeComponentConfig {
  // 是否启用子树组件化（默认 false）
  enabled?: boolean
  
  // 组件化粒度：'all' 所有节点 | 'boundary' 仅组件边界
  granularity?: 'all' | 'boundary'
  
  // 最大深度（超过后不再组件化）
  maxDepth?: number
}
```

### SchemaFragmentConfig

Schema 碎片化配置。

```typescript
interface SchemaFragmentConfig {
  // 是否启用碎片化（默认 false）
  enabled?: boolean
  
  // 碎片粒度：'node' 每个节点 | 'component' 仅组件边界
  granularity?: 'node' | 'component'
}
```

## Model 相关类型

### ModelOptions

Model 绑定的配置选项。

```typescript
interface ModelOptions {
  // 路径分隔符（默认 '.'）
  separator?: string
  
  // 全局 lazy 模式：true 时所有未显式设置 lazy 的 model 均不预写 state
  lazy?: boolean
}
```

### ModelConfig

组件 model 配置。

```typescript
interface ModelConfig {
  // 值属性名（如 modelValue, value）
  prop: string
  
  // 更新事件名（如 update:modelValue, input, change）
  event: string
}
```

### ModelScopeConfig

Model 作用域/绑定配置（来自 @variojs/schema）。

```typescript
interface ModelScopeConfig {
  // 绑定路径
  readonly path: string
  
  // true 时仅作子节点路径作用域，不在本节点绑定
  readonly scope?: boolean
  
  // 状态未初始化时使用的默认值
  readonly default?: unknown
  
  // true 时不预写 state，仅当用户修改该绑定值后才写入 state
  readonly lazy?: boolean
}
```

## 错误处理类型

### ErrorBoundaryConfig

错误边界配置。

```typescript
interface ErrorBoundaryConfig {
  // 是否启用错误边界（默认 true）
  enabled?: boolean
  
  // 错误显示组件（自定义错误UI）
  fallback?: (error: Error) => VNode
  
  // 错误恢复回调
  onRecover?: (error: Error) => void
}
```

## Schema 查询类型

### SchemaQueryApi

Schema 查询 API。

```typescript
interface SchemaQueryApi {
  // 按 ID 查找节点
  findById: (id: string) => NodeWrapper | null
  
  // 按类型查找节点
  findByType: (type: string) => NodeWrapper[]
  
  // 按条件查找节点
  findAll: (predicate: (node: SchemaNode) => boolean) => NodeWrapper[]
}
```

### SchemaQueryOptions

Schema 查询选项。

```typescript
interface SchemaQueryOptions {
  // 是否启用懒加载（默认 true）
  lazy?: boolean
  
  // 是否缓存查询结果（默认 true）
  cache?: boolean
}
```

### NodeWrapper

包装的 Schema 节点，包含额外的上下文信息。

```typescript
interface NodeWrapper {
  // Schema 节点
  node: SchemaNode
  
  // 节点路径
  path: string
  
  // 父节点（如果有）
  parent: NodeWrapper | null
}
```

### SchemaStats

Schema 统计信息。

```typescript
interface SchemaStats {
  // 总节点数
  totalNodes: number
  
  // 组件节点数
  componentNodes: number
  
  // 元素节点数
  elementNodes: number
  
  // 文本节点数
  textNodes: number
  
  // 最大深度
  maxDepth: number
  
  // 节点类型分布
  typeDistribution: Record<string, number>
}
```

## Refs 相关类型

### RefsRegistry

模板引用注册表。

```typescript
class RefsRegistry {
  // 注册一个 ref
  register(name: string): Ref<any>
  
  // 获取指定的 ref
  get(name: string): Ref<any> | undefined
  
  // 获取所有 refs
  getAll(): Record<string, Ref<any>>
  
  // 清除所有 refs
  clear(): void
  
  // 移除指定的 ref
  remove(name: string): boolean
}
```

## Provide/Inject 类型

### InjectConfig

Inject 配置。

```typescript
type InjectConfig = 
  | string                           // 简单形式
  | {
      from?: string | InjectionKey    // 注入源
      default?: any                   // 默认值
    }
```

## 指令相关类型

### DirectiveConfig

指令配置（来自 @variojs/schema）。

```typescript
type DirectiveConfig = 
  | DirectiveObject[]           // 完整对象数组
  | DirectiveArray              // 单个数组简写
  | DirectiveArray[]            // 数组简写数组
  | Record<string, unknown>     // 对象映射
```

### DirectiveObject

完整的指令对象。

```typescript
interface DirectiveObject {
  // 指令名
  name: string
  
  // 指令值
  value?: unknown
  
  // 指令参数
  arg?: string
  
  // 指令修饰符
  modifiers?: Record<string, boolean>
}
```

### DirectiveArray

数组简写格式。

```typescript
type DirectiveArray = [
  name: string,
  value?: unknown,
  arg?: string,
  modifiers?: Record<string, boolean>
]
```

## 生命周期类型

### LifecycleHooks

生命周期钩子名称。

```typescript
type LifecycleHookName = 
  | 'onBeforeMount'
  | 'onMounted'
  | 'onBeforeUpdate'
  | 'onUpdated'
  | 'onBeforeUnmount'
  | 'onUnmounted'
```

## 事件处理类型

### EventHandler

事件处理器类型（来自 @variojs/schema）。

```typescript
type EventHandler = 
  | Action                    // 单个 Action 对象
  | Action[]                  // Action 数组
  | string                    // 方法名简写
  | string[]                  // 多个方法名
  | EventArray                // 数组简写格式
```

### EventArray

事件数组简写格式。

```typescript
type EventArray = [
  type: 'call' | 'emit' | 'set',
  method: string,
  args?: unknown[],
  modifiers?: string[] | Record<string, boolean>
]
```

## 路径相关类型

### PathSegment

路径段（来自 @variojs/core）。

```typescript
type PathSegment = 
  | string              // 普通属性名
  | number              // 数组索引
  | LoopItemSegment     // 循环项
```

### LoopItemSegment

循环项路径段。

```typescript
interface LoopItemSegment {
  type: 'loop-item'
  itemKey: string
  indexKey?: string
  item: unknown
  index: number
}
```

## 工具类型

### VarioNodeRenderer

节点渲染器接口（用于自定义渲染器）。

```typescript
interface VarioNodeRenderer {
  // 创建 VNode
  createVNode(
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack?: PathSegment[],
    nodeContext?: NodeContext,
    parentMap?: ParentMap,
    path?: string
  ): VNode
  
  // 渲染子节点
  renderChildren(
    children: SchemaNode[] | string,
    ctx: RuntimeContext,
    modelPathStack?: PathSegment[],
    nodeContext?: NodeContext,
    parentMap?: ParentMap
  ): VNode[]
}
```

### NodeContext

节点上下文（用于 $parent、$root 访问）。

```typescript
interface NodeContext {
  // 节点 ID
  id: string
  
  // 节点路径
  path: string
  
  // 父节点 ID
  parentId?: string
  
  // 根节点 ID
  rootId: string
  
  // 节点深度
  depth: number
}
```

## 类型守卫

### isVueSchemaNode

检查是否为 Vue Schema 节点。

```typescript
function isVueSchemaNode(node: any): node is VueSchemaNode {
  return node && typeof node === 'object' && 'type' in node
}
```

### hasRef

检查节点是否有 ref 属性。

```typescript
function hasRef(node: SchemaNode): node is VueSchemaNode & { ref: string } {
  return 'ref' in node && typeof node.ref === 'string'
}
```

### hasLifecycleHooks

检查节点是否有生命周期钩子。

```typescript
function hasLifecycleHooks(node: SchemaNode): node is VueSchemaNode {
  return (
    'onBeforeMount' in node ||
    'onMounted' in node ||
    'onBeforeUpdate' in node ||
    'onUpdated' in node ||
    'onBeforeUnmount' in node ||
    'onUnmounted' in node
  )
}
```

## 类型推导

### InferState

从 Schema 推导状态类型。

```typescript
type InferState<S extends Schema> = 
  S extends Schema<infer TState> ? TState : Record<string, unknown>
```

### InferMethods

从 methods 配置推导方法类型。

```typescript
type InferMethods<M extends Record<string, Function>> = {
  [K in keyof M]: M[K] extends (ctx: MethodContext<infer S>) => infer R
    ? (params?: any) => R
    : never
}
```

## 导出的类型

所有公开类型都从主入口导出：

```typescript
export type {
  // 核心类型
  VueSchemaNode,
  UseVarioOptions,
  UseVarioResult,
  MethodContext,
  
  // 渲染器类型
  VueRendererOptions,
  SubtreeComponentConfig,
  SchemaFragmentConfig,
  
  // Model 类型
  ModelOptions,
  ModelConfig,
  ModelScopeConfig,
  
  // 错误处理
  ErrorBoundaryConfig,
  
  // Schema 查询
  SchemaQueryApi,
  SchemaQueryOptions,
  NodeWrapper,
  SchemaStats,
  
  // Refs
  RefsRegistry,
  
  // 指令
  DirectiveConfig,
  DirectiveObject,
  DirectiveArray,
  
  // 事件
  EventHandler,
  EventArray,
  
  // 路径
  PathSegment,
  LoopItemSegment,
  
  // 工具类型
  VarioNodeRenderer,
  NodeContext,
  
  // 类型推导
  InferState,
  InferMethods
}
```

## 相关链接

- [API 文档](/packages/vue/api)
- [useVario 文档](/api/use-vario)
- [Schema 类型](/packages/schema/types)
- [Core 类型](/api/types)
