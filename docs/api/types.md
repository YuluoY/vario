# 类型支持

Vario 提供完整的 TypeScript 类型定义，通过 **@variojs/types** 包集中管理所有通用类型。

## 包结构

```typescript
// @variojs/types - 集中的类型定义包
import type {
  // Schema 类型
  SchemaNode,
  Schema,
  ModelModifiers,
  EventModifiers,
  EventModifier,
  CommonEventName,
  EventName,
  ModelScopeConfig,
  LoopConfig,
  EventHandler,
  DirectiveConfig,

  // 文档信封类型（v0.4+）
  SchemaDocument,
  SchemaVersion,
  NodeId,
  MaterialManifest,

  // Action 类型
  Action,
  ActionType,
  ActionMap,

  // Runtime 类型
  RuntimeContext,
  MethodHandler,
  ExecutionMetadata,
  MethodsRegistry,
  CreateContextOptions,

  // Expression 类型
  ExpressionOptions,
  ExpressionCache,

  // 工具类型
  PathSegment,
  GetPathValue,
  SetPathValue,
  OnStateChangeCallback,
  InferStateType,

  // Error 类型
  ErrorContext,
  SchemaValidationErrorContext
} from '@variojs/types'

// @variojs/vue - Vue 特定类型
import type {
  VueSchemaNode,
  UseVarioOptions,
  UseVarioResult,
  MethodContext
} from '@variojs/vue'
```

## 核心类型

### SchemaNode\<TState>

Schema 节点的基础类型定义，支持状态类型泛型：

```typescript
import type { SchemaNode } from '@variojs/types'

interface MyState {
  username: string
  items: Array<{ id: string; name: string }>
}

const schema: SchemaNode<MyState> = {
  type: 'div',                    // ✅ type（不是 tag）
  model: 'username',              // ✅ 字符串路径绑定
  cond: 'items.length > 0',       // ✅ 条件渲染（v-if 语义）
  show: 'username !== ""',        // ✅ 条件显示（v-show 语义）
  loop: {                         // ✅ LoopConfig
    items: 'items',               //    数据源表达式
    itemKey: 'item',              //    循环变量名
    indexKey: 'index',            //    可选：索引变量名
    key: 'id',                    //    可选（v0.4+）：稳定 item key
    virtual: true                 //    可选（v0.4+）：宿主虚拟化
  },
  events: {
    click: { type: 'call', method: 'handleClick' }
  }
}
```

### ModelModifiers

Model 修饰符类型，支持 Vue 3 标准修饰符和自定义修饰符：

```typescript
import type { ModelModifiers } from '@variojs/types'

// 数组形式
const modifiers1: ModelModifiers = ['trim', 'number']

// 对象形式
const modifiers2: ModelModifiers = {
  trim: true,
  number: true,
  custom: true  // 自定义修饰符
}

// 在 Schema 中使用
const schema: SchemaNode = {
  type: 'ElInput',
  model: {
    path: 'username',       // ✅ 对象形式：path 必填
    modifiers: ['trim', 'lazy']  // ✅ 类型安全
  }
}
```

### EventModifiers 和 EventName

事件修饰符和事件名称类型，支持点语法：

```typescript
import type { EventModifiers, EventName, CommonEventName } from '@variojs/types'

// 事件修饰符
const modifiers: EventModifiers = ['stop', 'prevent']

// 事件名称（支持修饰符点语法）
const events: Record<EventName, any> = {
  'click': { type: 'call', method: 'onClick' },
  'click.stop': { type: 'call', method: 'onClickWithStop' },
  'keydown.enter': { type: 'call', method: 'onEnter' },
  'keydown.ctrl.enter': { type: 'call', method: 'onCtrlEnter' }
}

// 常见事件名称
const commonEvent: CommonEventName = 'input'  // ✅ 类型提示
```

### Action 类型

增强的 Action 类型，支持智能类型推导：

```typescript
import type { Action, ActionType } from '@variojs/types'

// Action 类型会自动推导必需属性
const action1: Action = {
  type: 'call',  // ✅ IDE 提示：'call' | 'set' | 'emit' | ...
  method: 'handleSubmit',
  params: { id: 1 }  // ✅ 可选，支持 string 表达式或对象
}

const action2: Action = {
  type: 'set',
  path: 'user.name',  // ✅ type='set' 时必须有 path
  value: '{{ newName }}'
}

const action3: Action = {
  type: 'emit',
  event: 'submit',  // ✅ type='emit' 时必须有 event
  data: '{{ formData }}'
}
```

### RuntimeContext\<TState>

运行时上下文类型，包含节点上下文属性：

```typescript
import type { RuntimeContext, SchemaNode } from '@variojs/types'

interface MyState {
  count: number
  user: { name: string }
}

// 在方法中使用
methods: {
  handleClick: ({ ctx }: { ctx: RuntimeContext<MyState> }) => {
    // ✅ 状态类型推导
    ctx.count++  // MyState['count']
    ctx.user.name = 'John'  // MyState['user']['name']
    
    // ✅ 节点上下文（自动推导为 SchemaNode<MyState>）
    ctx.$self?.type  // 当前节点
    ctx.$parent?.props  // 父节点
    ctx.$siblings?.[0]?.model  // 兄弟节点
    ctx.$children?.[0]?.loop  // 子节点
    
    // ✅ 系统 API
    ctx.$emit('update', { count: ctx.count })
    ctx.$methods['someMethod'](ctx, params)
    
    // ✅ 循环上下文
    ctx.$item  // 循环当前项
    ctx.$index  // 循环索引
    
    // ✅ 事件值
    ctx.$event  // 事件对象或组件 emit 值
  }
}
```

### VueSchemaNode

Vue 特定的 Schema 节点类型：

```typescript
import type { VueSchemaNode } from '@variojs/vue'

const schema: VueSchemaNode = {
  type: 'div',
  ref: 'myDiv',  // ✅ Vue 模板引用

  // ✅ 生命周期钩子（值为 methods 中的方法名）
  onMounted: 'init',
  onUnmounted: 'cleanup',
  onUpdated: 'handleUpdate',
  onActivated: 'resumeState',      // v0.4+：KeepAlive 激活
  onDeactivated: 'pauseState',     // v0.4+：KeepAlive 停用

  // ✅ Vue 特性
  provide: { theme: 'dark' },
  inject: ['userInfo'],
  teleport: 'body',
  transition: 'fade',
  keepAlive: true,

  // ✅ 继承 SchemaNode 所有属性
  model: 'fieldName',
  show: 'visible',
  events: {
    click: { type: 'call', method: 'onClick' }
  }
}
```

### SchemaDocument 与 MaterialManifest（v0.4+）

存储与跨端传输用的文档信封类型，配合 `@variojs/schema` 的 `serializeSchema`/`parseSchema`/`migrateToV1` 使用：

```typescript
import type { SchemaDocument, MaterialManifest } from '@variojs/types'

const doc: SchemaDocument = {
  version: 1,                    // 0 = 裸 SchemaNode，1 = 信封
  schemaVersion: 1,              // schema 结构版本（可选）
  id: 'page:home',               // 文档 ID（可选）
  root: { type: 'div', children: [] },  // ★ 必填：schema 根节点
  initialState: { rows: [] },    // 文档自带初始 state（可选）
  materials: [{                  // 物料清单（可选）
    name: 'ElTable',
    version: '2.5.0',
    events: ['select'],
    capabilities: ['virtual']
  }],
  extensions: {}                 // 自定义扩展数据（可选）
}
```

defineSchema 返回的 `VarioView` 上可通过 `document` 字段挂载。完整说明见 [@variojs/schema 文档与序列化迁移](/packages/schema/document)。

## 类型推导

### 状态类型推导

```typescript
import type { InferStateType } from '@variojs/types'

const view = {
  state: { count: 0, name: '' },
  schema: { type: 'div' },
  services: {}
}

// 自动推导状态类型
type State = InferStateType<typeof view>  // { count: number; name: string }

// 在 useVario 中使用
const { state } = useVario<State>(view.schema, {
  state: view.state
})

state.count++  // ✅ 类型安全
```

### 路径类型推导

```typescript
import type { GetPathValue, SetPathValue } from '@variojs/types'

interface State {
  user: {
    profile: {
      name: string
      age: number
    }
  }
  items: Array<{ id: string }>
}

// 获取路径值类型
type Name = GetPathValue<State, 'user.profile.name'>  // string
type Age = GetPathValue<State, 'user.profile.age'>  // number
type Items = GetPathValue<State, 'items'>  // Array<{ id: string }>

// 设置路径值类型（与获取相同）
type SetName = SetPathValue<State, 'user.profile.name'>  // string
```

## TypeScript 配置

推荐的 tsconfig.json 配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "types": ["@variojs/types"],
    "paths": {
      "@variojs/types": ["./node_modules/@variojs/types/dist/index.d.ts"],
      "@variojs/core": ["./node_modules/@variojs/core/dist/index.d.ts"],
      "@variojs/schema": ["./node_modules/@variojs/schema/dist/index.d.ts"],
      "@variojs/vue": ["./node_modules/@variojs/vue/dist/index.d.ts"]
    }
  }
}
```

## 相关文档

- [Vue 类型定义](/packages/vue/types) - Vue 特定类型详解
- [useVario API](/api/use-vario) - useVario 完整 API 和类型
- [Schema 类型](/packages/schema/types) - Schema 定义详解
- [节点上下文](/guide/node-context) - 节点关系访问
