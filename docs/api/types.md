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
  
  // Action 类型
  Action,
  ActionType,
  ActionMap,
  
  // Runtime 类型
  RuntimeContext,
  MethodHandler,
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
  MethodContext,
  VueRendererOptions
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
  tag: 'div',
  model: { bind: 'username' },  // ✅ 类型安全：keyof MyState
  if: '{{ items.length > 0 }}',  // ✅ 表达式类型推导
  loop: {
    from: '{{ items }}',  // ✅ 数组路径类型安全
    as: 'item'
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
  tag: 'ElInput',
  model: {
    bind: 'username',
    modifier: ['trim', 'lazy']  // ✅ 类型安全
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

const schema: VueSchemaNode<MyState> = {
  tag: 'div',
  ref: 'myDiv',  // ✅ Vue 模板引用
  
  // ✅ 生命周期钩子
  onMounted: 'init',
  onUnmounted: 'cleanup',
  onUpdated: 'handleUpdate',
  
  // ✅ Vue 特性
  provide: { theme: 'dark' },
  inject: ['userInfo'],
  teleport: 'body',
  transition: 'fade',
  keepAlive: true,
  
  // ✅ 继承 SchemaNode 所有属性
  model: 'fieldName',
  show: '{{ visible }}',
  events: {
    click: { type: 'call', method: 'onClick' }
  }
}
```

## 类型推导

### 状态类型推导

```typescript
import type { InferStateType } from '@variojs/types'

const view = {
  state: { count: 0, name: '' },
  schema: { tag: 'div' },
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
