# @vario/vue API 文档

本文档详细介绍 @vario/vue 包的所有公开 API。

## useVario

Vue 3 组合式 API，将 Vario Schema 渲染为 Vue VNode。

### 类型签名

```typescript
function useVario<TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
  options?: UseVarioOptions<TState>
): UseVarioResult<TState>
```

### 参数

#### schema

Schema 定义，支持三种形式：

- **静态对象**：`Schema<TState>` - 直接传入 Schema 对象
- **工厂函数**：`() => Schema<TState>` - 返回 Schema 的函数
- **计算属性**：`ComputedRef<Schema<TState>>` - Vue 计算属性

```typescript
// 静态 Schema
const schema = { type: 'div', children: 'Hello' }
useVario(schema)

// 工厂函数
useVario(() => ({ type: 'div', children: `Count: ${count.value}` }))

// 计算属性
const schemaRef = computed(() => ({ type: 'div', children: state.text }))
useVario(schemaRef)
```

#### options

可选配置对象，类型为 `UseVarioOptions<TState>`。

### UseVarioOptions

| 属性 | 类型 | 说明 |
|------|------|------|
| `state` | `TState` | 初始状态（自动包裹为响应式对象） |
| `computed` | `Record<string, Function \| ComputedRef>` | 计算属性（Options 或 Composition 风格） |
| `methods` | `Record<string, Function>` | 方法（注册到 `$methods`） |
| `modelBindings` | `Record<string, any>` | 双向绑定配置（非标准组件） |
| `onEmit` | `(event: string, data?: unknown) => void` | 事件处理回调 |
| `onError` | `(error: Error) => void` | 错误处理回调 |
| `errorBoundary` | `ErrorBoundaryConfig` | 错误边界配置 |
| `rendererOptions` | `VueRendererOptions` | 渲染器配置 |
| `app` | `App \| null` | Vue 应用实例（用于获取全局组件） |
| `components` | `Record<string, any>` | 全局组件映射 |
| `exprOptions` | `ExpressionOptions` | 表达式求值配置 |
| `modelOptions` | `ModelOptions` | Model 绑定配置 |

#### state

初始状态对象，会自动包裹为 Vue 响应式对象（使用 `reactive`）。

```typescript
useVario(schema, {
  state: {
    count: 0,
    user: { name: 'Alice' }
  }
})
```

#### computed

计算属性，支持两种风格：

**Options 风格**（函数）：
```typescript
useVario(schema, {
  state: { count: 0 },
  computed: {
    double: (state) => state.count * 2,
    message: (state) => `Count is ${state.count}`
  }
})
```

**Composition 风格**（ComputedRef）：
```typescript
const doubleCount = computed(() => state.count * 2)
useVario(schema, {
  state,
  computed: {
    double: doubleCount
  }
})
```

#### methods

方法定义，所有方法统一注册到 `$methods`，在 Schema 中通过方法名调用。

```typescript
useVario(schema, {
  state: { count: 0 },
  methods: {
    increment: ({ state }) => {
      state.count++
    },
    addValue: ({ state, params }) => {
      state.count += params.value
    },
    handleClick: ({ event, state }) => {
      console.log('Clicked', event)
      state.clicked = true
    }
  }
})
```

**MethodContext** 参数：

```typescript
interface MethodContext<TState> {
  state: TState          // 响应式状态
  params: any           // 方法参数
  event?: Event         // 触发的事件对象
  ctx: RuntimeContext   // 底层运行时上下文
}
```

#### modelBindings

为非标准组件注册双向绑定配置：

```typescript
import { registerModelConfig } from '@variojs/vue'

useVario(schema, {
  modelBindings: {
    'CustomInput': { prop: 'value', event: 'input' },
    'DatePicker': { prop: 'date', event: 'update:date' }
  }
})
```

#### errorBoundary

错误边界配置（默认启用）：

```typescript
useVario(schema, {
  errorBoundary: {
    enabled: true,
    fallback: (error) => h('div', { style: 'color: red' }, [
      h('h3', 'Error'),
      h('pre', error.message)
    ]),
    onRecover: (error) => {
      console.log('Recovered from error', error)
    }
  }
})
```

#### rendererOptions

渲染器配置，详见 [VueRendererOptions](#vuerendereroptions)。

#### modelOptions

Model 绑定的全局配置：

```typescript
useVario(schema, {
  modelOptions: {
    separator: '.',  // 路径分隔符（默认 '.'）
    lazy: false      // 全局 lazy 模式（默认 false）
  }
})
```

### 返回值

`UseVarioResult<TState>` 对象包含：

| 属性 | 类型 | 说明 |
|------|------|------|
| `vnode` | `Ref<VNode \| null>` | 渲染的 VNode |
| `state` | `TState` | 响应式状态对象 |
| `ctx` | `Ref<RuntimeContext<TState>>` | 运行时上下文 |
| `refs` | `Record<string, Ref<any>>` | 模板引用集合 |
| `error` | `Ref<Error \| null>` | 当前错误（如果有） |
| `stats` | `Ref<SchemaStats>` | Schema 统计信息 |
| `retry` | `() => void` | 手动触发重新渲染 |
| `findById` | `(id: string) => NodeWrapper \| null` | 按 ID 查找节点 |
| `findByType` | `(type: string) => NodeWrapper[]` | 按类型查找节点 |
| `findAll` | `(predicate) => NodeWrapper[]` | 按条件查找节点 |

#### vnode

渲染的 Vue VNode，可直接在模板中使用：

```vue
<template>
  <component :is="vnode" />
</template>

<script setup>
const { vnode } = useVario(schema)
</script>
```

#### state

响应式状态对象，可直接访问和修改：

```typescript
const { state } = useVario(schema, {
  state: { count: 0 }
})

// 直接修改（会触发重新渲染）
state.count++
```

#### refs

模板引用集合，通过 Schema 中的 `ref` 属性声明：

```typescript
const schema = {
  type: 'input',
  ref: 'myInput'
}

const { refs } = useVario(schema)

// 访问引用
onMounted(() => {
  refs.myInput.value?.focus()
})
```

#### Schema 查询方法

提供强大的 Schema 查询能力：

```typescript
const { findById, findByType, findAll } = useVario(schema)

// 按 ID 查找
const node = findById('submit-btn')

// 按类型查找
const buttons = findByType('Button')

// 按条件查找
const inputNodes = findAll((node) => 
  node.type === 'input' && node.props?.type === 'text'
)
```

## VueRenderer

核心渲染器类，将 Schema 转换为 Vue VNode。通常不需要直接使用，`useVario` 内部会创建。

### 构造函数

```typescript
class VueRenderer {
  constructor(options?: VueRendererOptions)
}
```

### VueRendererOptions

| 属性 | 类型 | 说明 |
|------|------|------|
| `instance` | `ComponentInternalInstance \| null` | 组件实例 |
| `app` | `App \| null` | Vue 应用实例 |
| `components` | `Record<string, any>` | 全局组件映射 |
| `directives` | `Record<string, Directive>` | 自定义指令映射 |
| `getState` | `() => any` | 获取响应式状态 |
| `refsRegistry` | `RefsRegistry` | Refs 注册表 |
| `modelOptions` | `ModelOptions` | Model 配置 |
| `usePathMemo` | `boolean` | 启用 path-memo 缓存（默认 true） |
| `loopItemAsComponent` | `boolean` | 列表项组件化（默认 false） |
| `subtreeComponent` | `SubtreeComponentConfig` | 子树组件化配置 |
| `schemaFragment` | `SchemaFragmentConfig` | Schema 碎片化配置 |

#### 性能优化选项

**usePathMemo**（默认 `true`）

启用路径缓存，缓存未变化分支的 VNode，性能提升 2-88 倍。

```typescript
useVario(schema, {
  rendererOptions: {
    usePathMemo: true
  }
})
```

**loopItemAsComponent**（默认 `false`）

将列表项组件化，单项更新时性能提升 4-29 倍。

```typescript
useVario(schema, {
  rendererOptions: {
    loopItemAsComponent: true
  }
})
```

**subtreeComponent**

子树组件化，大规模 UI 场景提升 2-12 倍。

```typescript
useVario(schema, {
  rendererOptions: {
    subtreeComponent: {
      enabled: true,
      granularity: 'boundary', // 'all' | 'boundary'
      maxDepth: 10
    }
  }
})
```

**schemaFragment**

Schema 碎片化，支持精确节点更新。

```typescript
useVario(schema, {
  rendererOptions: {
    schemaFragment: {
      enabled: true,
      granularity: 'node' // 'node' | 'component'
    }
  }
})
```

## 模型绑定

### createModelBinding

创建双向绑定配置。

```typescript
function createModelBinding(
  componentType: string,
  modelPath: string,
  ctx: RuntimeContext,
  component?: unknown,
  getState?: () => Record<string, unknown>,
  modelName?: string,
  schemaDefault?: unknown,
  schemaLazy?: boolean,
  modifiers?: Record<string, boolean>
): Record<string, unknown>
```

### registerModelConfig

注册自定义组件的 model 配置。

```typescript
function registerModelConfig(
  componentType: string,
  config: ModelConfig,
  modelName?: string
): void

interface ModelConfig {
  prop: string   // 值属性名
  event: string  // 更新事件名
}
```

**示例**：

```typescript
import { registerModelConfig } from '@variojs/vue'

// 注册单 model
registerModelConfig('CustomInput', {
  prop: 'value',
  event: 'input'
})

// 注册具名 model（Vue 3.4+）
registerModelConfig('RangePicker', {
  prop: 'start',
  event: 'update:start'
}, 'start')

registerModelConfig('RangePicker', {
  prop: 'end',
  event: 'update:end'
}, 'end')
```

### clearModelConfigs

清除所有自定义 model 配置。

```typescript
function clearModelConfigs(): void
```

## Refs

### RefsRegistry

模板引用注册表。

```typescript
class RefsRegistry {
  register(name: string): Ref<any>
  get(name: string): Ref<any> | undefined
  getAll(): Record<string, Ref<any>>
  clear(): void
  remove(name: string): boolean
}
```

### attachRef

为 VNode 添加 ref 处理。

```typescript
function attachRef(
  vnode: VNode,
  schema: VueSchemaNode,
  refsRegistry: RefsRegistry
): VNode
```

## Provide/Inject

### setupProvideInject

处理 provide/inject 配置。

```typescript
function setupProvideInject(
  schema: VueSchemaNode,
  ctx: RuntimeContext
): Record<string, any>
```

在 Schema 中使用：

```typescript
const schema = {
  type: 'div',
  provide: {
    theme: 'dark',
    user: '{{ currentUser }}'
  },
  children: [{
    type: 'child-component',
    inject: ['theme', 'user']
  }]
}
```

## Teleport

### createTeleport

创建 Teleport 组件。

```typescript
function createTeleport(
  target: string | boolean,
  children: VNode | VNode[]
): VNode
```

### shouldTeleport

检查是否应该使用 Teleport。

```typescript
function shouldTeleport(
  target: string | boolean | undefined
): target is string | boolean
```

在 Schema 中使用：

```typescript
const schema = {
  type: 'div',
  teleport: 'body',  // 或 '#modal-container'
  children: 'Modal content'
}
```

## Schema 查询

### useSchemaQuery

提供 Schema 查询能力。

```typescript
function useSchemaQuery(
  schema: Ref<Schema> | ComputedRef<Schema>,
  options?: SchemaQueryOptions
): SchemaQueryApi

interface SchemaQueryApi {
  findById: (id: string) => NodeWrapper | null
  findByType: (type: string) => NodeWrapper[]
  findAll: (predicate: (node: SchemaNode) => boolean) => NodeWrapper[]
}

interface NodeWrapper {
  node: SchemaNode
  path: string
  parent: NodeWrapper | null
}
```

## 类型定义

### VueSchemaNode

扩展的 Schema 节点类型，包含 Vue 特定属性。

```typescript
interface VueSchemaNode extends SchemaNode {
  // Vue 特定属性
  ref?: string
  provide?: Record<string, any>
  inject?: string[] | Record<string, any>
  teleport?: string | boolean
  transition?: string | TransitionProps
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

### MethodContext

方法上下文。

```typescript
interface MethodContext<TState extends Record<string, unknown>> {
  state: TState
  params: any
  event?: Event
  ctx: RuntimeContext<TState>
}
```

### ModelOptions

Model 绑定配置。

```typescript
interface ModelOptions {
  separator?: string  // 路径分隔符（默认 '.'）
  lazy?: boolean      // 全局 lazy 模式（默认 false）
}
```

## 工具函数

### 组件解析

```typescript
class ComponentResolver {
  resolve(type: string): any
  isNative(type: string): boolean
}
```

### 表达式求值

```typescript
class ExpressionEvaluator {
  evaluateExpr(expr: string, ctx: RuntimeContext): any
  evaluateTemplate(template: string, ctx: RuntimeContext): string
}
```

### 路径解析

```typescript
class ModelPathResolver {
  resolve(
    modelConfig: string | ModelScopeConfig,
    modelPathStack: PathSegment[],
    ctx: RuntimeContext
  ): string
}
```

## 最佳实践

1. **优先使用性能优化选项**：在大型应用中启用 `usePathMemo` 和 `loopItemAsComponent`
2. **合理使用 computed**：将复杂计算逻辑提取为 computed 属性
3. **方法命名规范**：使用清晰的动词开头（如 `handleClick`、`validateForm`）
4. **错误处理**：配置 `errorBoundary` 提供友好的错误提示
5. **类型安全**：使用 TypeScript 并为 state 定义明确的类型

## 相关链接

- [快速开始](/guide/quick-start)
- [状态管理](/guide/state)
- [Model 与路径](/guide/model-path)
- [性能优化](/guide/performance)
- [Vue 特性](/guide/vue-features)
