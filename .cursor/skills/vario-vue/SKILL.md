---
name: vario-vue
description: Build Vue 3 applications using @variojs/vue with declarative JSON Schema. Provides bidirectional binding, model modifiers, event modifiers, expressions, loops, node context ($parent/$siblings/$children), lifecycle hooks, refs, provide/inject, teleport, and full TypeScript type inference. Use when building Schema-driven Vue components, implementing dynamic forms, creating data-driven UIs, or working with @variojs/vue composables and VueSchemaNode definitions.
license: MIT
compatibility: Requires Vue 3.x, TypeScript 5.x, @variojs/types, @variojs/core, @variojs/schema, @variojs/vue packages.
---

# Vario Vue Integration

使用 `@variojs/vue` 在 Vue 3 中通过声明式 JSON Schema 构建类型安全的响应式 UI。

## 何时使用此技能

在以下场景使用此技能：
- 使用 `@variojs/vue` 构建 Vue 组件和 Schema 驱动的 UI
- 需要实现复杂表单、动态列表、数据展示等功能
- 使用 `useVario` composable 创建响应式 Schema 渲染器
- 编写 `VueSchemaNode` 定义并需要完整的 TypeScript 类型推导
- 需要双向绑定（model）、修饰符（trim/number/lazy）、表达式插值
- 实现循环渲染、条件显示、事件处理
- 访问节点关系（父节点、兄弟节点、子节点）进行组件间通信
- 集成 Vue 特性：生命周期钩子、模板引用（refs）、provide/inject、teleport、transition、keep-alive
- 需要 Schema 查询、动态修改节点、错误边界等高级功能

## 核心 API

### useVario

主要的 composable API，用于创建 Schema 驱动的 Vue 组件：

```typescript
import { useVario } from '@variojs/vue'
import type { VueSchemaNode, UseVarioOptions, UseVarioResult } from '@variojs/vue'

const { vnode, state, ctx, refs, error, stats, retry, findById, findAll } = useVario<MyState>(schema, options)
```

**类型签名：**
```typescript
function useVario<TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
  options?: UseVarioOptions<TState>
): UseVarioResult<TState>
```

**返回值（UseVarioResult）：**
- `vnode`: `Ref<VNode | null>` - 渲染的 Vue VNode
- `state`: `TState` - 响应式状态对象（自动同步到 RuntimeContext）
- `ctx`: `Ref<RuntimeContext<TState>>` - 运行时上下文，包含 $self/$parent/$siblings/$children 等节点关系
- `refs`: `Record<string, Ref<any>>` - 模板引用集合（通过 ref 属性设置）
- `error`: `Ref<Error | null>` - 当前渲染错误（配合 errorBoundary 使用）
- `stats`: `Ref<SchemaStats>` - Schema 统计信息（节点数、深度等，惰性计算）
- `retry`: `() => void` - 手动重试渲染（用于错误恢复）
- `findById`: `(id: string) => NodeWrapper | null` - 通过 ID 查找节点（O(1)）
- `findAll`: `(predicate: (node: SchemaNode) => boolean) => NodeWrapper[]` - 查找所有匹配节点

**选项（UseVarioOptions）：**
```typescript
interface UseVarioOptions<TState> {
  // 核心配置
  state?: TState                                    // 初始状态（自动转为响应式）
  computed?: Record<string, ((state: TState) => any) | ComputedRef<any>>  // 计算属性（Options 或 Composition 风格）
  methods?: Record<string, (ctx: MethodContext<TState>) => any>  // 方法定义（支持 async/await）
  
  // Model 配置
  modelBindings?: Record<string, ModelConfig>      // 自定义组件双向绑定配置
  modelOptions?: {                                  // 全局 Model 配置
    separator?: string                              // 路径分隔符（默认 '.'）
    lazy?: boolean                                   // 全局惰性模式（不预写 state）
  }
  
  // 事件与错误
  onEmit?: (event: string, data?: unknown) => void  // 事件发射处理
  onError?: (error: Error) => void                  // 错误处理
  errorBoundary?: {                                 // 错误边界配置
    enabled?: boolean                               // 是否启用（默认 true）
    fallback?: (error: Error) => VNode              // 错误 UI
    onRecover?: (error: Error) => void              // 错误恢复回调
  }
  
  // 渲染器与组件
  rendererOptions?: VueRendererOptions              // 渲染器配置
  app?: App | null                                  // Vue 应用实例（非组件上下文使用）
  components?: Record<string, any>                  // 全局组件映射（非组件上下文使用）
  
  // 表达式配置
  exprOptions?: ExpressionOptions                   // 表达式求值配置
}
```

**MethodContext 类型：**
```typescript
interface MethodContext<TState> {
  state: TState                    // 响应式状态
  ctx: RuntimeContext<TState>      // 运行时上下文（包含节点关系）
  params: any                       // 方法参数
  value?: any                       // 事件值（$event 的别名）
  event?: any                       // 原始事件对象
}
```

## Schema 节点属性

### 基础类型

```typescript
interface SchemaNode<TState> {
  // 核心属性
  tag: string                              // 组件/元素标签（动态表达式或静态字符串）
  props?: SchemaNodeProps<TState>          // Props（支持表达式、Kebab-case 自动转换、class/style 智能合并）
  children?: SchemaChild<TState> | SchemaChild<TState>[]  // 子节点（静态/表达式/混合）
  
  // 节点标识
  id?: string                              // 唯一 ID（用于 findById 快速查找）
  ref?: string                             // 模板引用名（通过 refs 访问 DOM/组件实例）
  key?: string | number                    // 列表渲染 key（循环中必需）
  
  // 条件与循环
  if?: string                              // 条件渲染（表达式求值为 truthy 时渲染）
  loop?: {                                  // 循环渲染
    from: string                           // 数据源表达式（支持 Array/Object/Number）
    as: string                             // 循环变量名（$scope 中访问）
    index?: string                         // 索引/键变量名（可选）
  }
  
  // Model 双向绑定
  model?: {                                 // 组件双向绑定
    bind: string                           // 绑定路径（支持深层 'user.profile.name'）
    on?: string                            // 更新事件名（默认 'update:modelValue'）
    modifier?: ModelModifiers              // 修饰符（trim/number/lazy 或自定义）
  }
  
  // 事件绑定
  events?: Record<EventName, ActionConfig>  // 事件处理器（支持修饰符 'click.stop.prevent'）
  
  // 生命周期钩子（在节点挂载/卸载时触发）
  onMounted?: string | ActionConfig        // 节点挂载后执行（访问 DOM/refs）
  onUpdated?: string | ActionConfig        // 节点更新后执行（响应 props 变化）
  onUnmounted?: string | ActionConfig      // 节点卸载前执行（清理副作用）
  onBeforeMount?: string | ActionConfig    // 节点挂载前执行
  onBeforeUpdate?: string | ActionConfig   // 节点更新前执行
  onBeforeUnmount?: string | ActionConfig  // 节点卸载前执行（同步清理）
  onActivated?: string | ActionConfig      // KeepAlive 激活时（配合 keep-alive）
  onDeactivated?: string | ActionConfig    // KeepAlive 停用时
  
  // 指令（原生 Vue 指令）
  directives?: DirectiveConfig[]           // v-focus、v-loading 等自定义指令
  
  // 插槽（高级功能）
  slots?: Record<string, SlotConfig>       // 具名插槽定义
}
```

### ModelModifiers 类型

支持 Vue 内置修饰符和自定义修饰符：

```typescript
type ModelModifiers = string[] | Record<string, boolean> | {
  trim?: boolean    // 自动去除首尾空格
  number?: boolean  // 自动转换为数字（parseFloat）
  lazy?: boolean    // 在 change 事件而非 input 时更新（性能优化）
  [custom: string]: boolean  // 自定义修饰符（通过 modelBindings 配置）
}

// 使用示例
model: { bind: 'user.email', modifier: ['trim'] }
model: { bind: 'age', modifier: { number: true, lazy: true } }
```

### EventName 与 EventModifiers

支持点语法链式修饰符（50+ 修饰符）：

```typescript
type EventName = string  // 'click' | 'click.stop' | 'keydown.enter.ctrl' | 'submit.prevent' 等

// 支持的修饰符分类：
// - DOM: stop, prevent, self, capture, once, passive
// - 鼠标: left, right, middle
// - 键盘: enter, tab, delete, esc, space, up, down, left, right, ctrl, alt, shift, meta
// - 系统: ctrl, alt, shift, meta, exact
// - Element Plus: native（穿透到原生事件）
```

**示例：**
```typescript
events: {
  'click.stop.prevent': { type: 'call', method: 'handleClick' },  // 阻止冒泡和默认行为
  'keydown.enter.ctrl': { type: 'call', method: 'handleSubmit' },  // Ctrl+Enter 快捷键
  'input.lazy': { type: 'call', method: 'handleInput' }            // 延迟处理
}
```

### 双向绑定详解

```typescript
{
  tag: 'ElInput',
  model: { bind: 'name' }                    // 扁平路径
  // 或
  model: { bind: 'user.name' }              // 嵌套路径（自动创建对象结构）
  // 或
  model: { bind: 'user.name', lazy: true }  // 惰性：不预写 state，仅用户修改后才写入
  // 或
  model: { bind: 'email', modifier: ['trim'] }   // 带修饰符
}
// 整棵 schema 默认惰性：useVario(schema, { modelOptions: { lazy: true } }) 则所有未显式设置 lazy 的 model 均不预写 state
```

### 循环渲染详解

```typescript
{
  tag: 'div',
  loop: {
    from: 'userList',              // 数据源（表达式）
    as: 'item',                    // 循环变量名
    index: 'idx'                   // 索引变量名（可选）
  },
  children: '{{ item.name }}',     // 使用循环变量
  key: '{{ item.id }}'             // 列表 key（必需）
}
```

### 事件处理

支持多种 Action 类型，并提供智能类型推导：

```typescript
// ActionConfig 类型（自动推导 params 类型）
type ActionConfig = 
  | { type: 'call'; method: string; params?: any }           // 调用方法（params 自动推导为方法参数类型）
  | { type: 'set'; path: string; value?: string }            // 设置状态
  | { type: 'emit'; event: string; data?: any }              // 发射事件
  | { type: 'sequence'; actions: ActionConfig[] }            // 顺序执行多个操作
  | { type: 'parallel'; actions: ActionConfig[] }            // 并行执行多个操作
  | { type: 'condition'; if: string; then: ActionConfig; else?: ActionConfig }  // 条件执行
  | string                                                   // 简写：表达式字符串（自动推导为 call/set）

// 示例：
{
  tag: 'ElButton',
  events: {
    'click.stop': {
      type: 'call',                // 调用方法
      method: 'handleClick',       // 方法名（在 methods 中定义）
      params: { id: '{{ item.id }}' }  // 参数（支持表达式）
    }
  }
}

// 简写形式：
{
  tag: 'ElButton',
  events: {
    click: 'handleClick'           // 自动推导为 { type: 'call', method: 'handleClick' }
  }
}

// 设置状态：
{
  tag: 'ElButton',
  events: {
    click: {
      type: 'set',                 // 设置状态
      path: 'count',
      value: '{{ count + 1 }}'
    }
  }
}

// 复杂操作：
{
  tag: 'ElButton',
  events: {
    click: {
      type: 'sequence',            // 顺序执行
      actions: [
        { type: 'call', method: 'validate' },
        {
          type: 'condition',
          if: 'isValid',
          then: { type: 'call', method: 'submit' },
          else: { type: 'emit', event: 'error', data: { message: 'Validation failed' } }
        }
      ]
    }
  }
}
```

### 表达式

```typescript
{
  tag: 'div',
  children: '{{ firstName + " " + lastName }}',  // 文本插值
  if: 'count > 10',                              // 条件表达式（替代 show）
  props: {
    disabled: '{{ !isValid }}'                   // 属性表达式
  }
}
```

## 节点上下文（Node Context）

**RuntimeContext 提供节点关系访问：**

```typescript
interface RuntimeContext<TState> {
  $state: TState                        // 全局状态
  $self?: SchemaNode<TState>            // 当前节点（Schema 定义）
  $parent?: SchemaNode<TState> | null   // 父节点（支持链式 $parent.$parent...）
  $siblings?: SchemaNode<TState>[]      // 兄弟节点数组
  $children?: SchemaNode<TState>[]      // 子节点数组
  $scope?: Record<string, any>          // 循环作用域（loop 变量）
  $methods: Record<string, Function>    // 方法集合
  $computed: Record<string, any>        // 计算属性
  $refs: Record<string, any>            // 模板引用
}
```

**使用场景：**

1. **表单联动验证：**
```typescript
{
  tag: 'ElInput',
  model: { bind: 'password' },
  events: {
    input: {
      type: 'call',
      method: 'validateConfirmPassword',
      // 在方法中通过 ctx.$siblings 找到确认密码输入框
    }
  }
}
```

2. **动态列表操作：**
```typescript
methods: {
  deleteItem({ ctx, params }: MethodContext<MyState>) {
    const currentNode = ctx.$self       // 当前节点
    const parentNode = ctx.$parent      // 父节点（列表容器）
    const siblings = ctx.$siblings      // 同级项
    const index = params.index
    // 删除逻辑...
  }
}
```

3. **级联选择器：**
```typescript
{
  tag: 'ElSelect',
  model: { bind: 'province' },
  events: {
    change: {
      type: 'call',
      method: 'onProvinceChange',
      // 方法中通过 ctx.$parent.$children 找到市级选择器并重置
    }
  }
}
```

**实现原理：** 使用 Proxy 实现 `$parent` 链式访问，WeakMap 存储父节点引用，自动维护节点关系树。详见 [节点上下文指南](https://variojs.org/guide/node-context)。

### Vue 特性

**模板引用：**
```typescript
{
  tag: 'ElInput',
  ref: 'inputRef'                 // 在 refs.inputRef.value 中访问 DOM/组件实例
}

// 在方法中使用：
methods: {
  focusInput({ ctx }: MethodContext<MyState>) {
    ctx.$refs.inputRef?.focus()   // 调用 DOM 方法
  }
}
```

**生命周期钩子：**
```typescript
{
  tag: 'div',
  onMounted: 'initData',          // 挂载后调用 methods.initData
  onUpdated: 'handleUpdate',      // 更新后触发
  onUnmounted: 'cleanup'          // 卸载前清理（取消订阅、清除定时器等）
}

// 支持 8 个钩子：onBeforeMount, onMounted, onBeforeUpdate, onUpdated, 
//                onBeforeUnmount, onUnmounted, onActivated, onDeactivated
```

**Provide/Inject：**
```typescript
// 提供数据
{
  tag: 'div',
  provide: { theme: 'dark', locale: 'zh-CN' }
}

// 注入数据
{
  type: 'ElButton',
  inject: ['theme', 'locale']    // 数组形式
  // 或
  inject: {                        // 对象形式
    myTheme: 'theme',
    myLocale: { from: 'locale', default: 'en' }
  }
}
```

**Teleport：**
```typescript
{
  type: 'div',
  teleport: 'body'                // 传送到 body
  // 或
  teleport: '#modal'              // 传送到 #modal
}
```

**Transition：**
```typescript
{
  type: 'div',
  transition: 'fade'              // 预设过渡名
  // 或
  transition: {
    name: 'fade',
    appear: true,
    mode: 'out-in'
  }
}
```

**Keep-alive：**
```typescript
{
  type: 'div',
  keepAlive: true
  // 或
  keepAlive: {
    include: 'ComponentA',
    exclude: 'ComponentB',
    max: 10
  }
}
```

## 使用模式

### 基础组件

```typescript
import { useVario } from '@variojs/vue'
import type { SchemaNode, UseVarioOptions } from '@variojs/vue'

interface MyState {
  name: string
}

const schema: SchemaNode<MyState> = {
  tag: 'div',
  children: [
    {
      tag: 'ElInput',
      model: { bind: 'name' },
      props: { placeholder: '请输入姓名' }
    },
    {
      tag: 'div',
      children: '你好，{{ name }}！'
    }
  ]
}

export default {
  setup() {
    const { vnode, state } = useVario<MyState>(schema, {
      state: { name: '' }
    })
    return { vnode, state }
  }
}
```

### 带方法的组件

```typescript
interface MyState {
  count: number
}

const schema: SchemaNode<MyState> = {
  tag: 'div',
  children: [
    {
      tag: 'ElButton',
      events: {
        'click.stop': 'handleClick'  // 简写形式
      },
      children: '点击次数：{{ count }}'
    }
  ]
}

const { vnode, state } = useVario<MyState>(schema, {
  state: { count: 0 },
  methods: {
    handleClick: ({ state, ctx }) => {
      state.count++
      console.log('Count:', state.count, 'CurrentNode:', ctx.$self)
    }
  }
})
```

### 循环列表（带节点上下文）

```typescript
interface TodoItem {
  id: number
  text: string
  completed: boolean
}

interface MyState {
  todos: TodoItem[]
}

const schema: SchemaNode<MyState> = {
  tag: 'div',
  children: [
    {
      tag: 'div',
      loop: {
        from: 'todos',
        as: 'item',
        index: 'idx'
      },
      key: '{{ item.id }}',
      children: [
        {
          tag: 'span',
          children: '{{ item.text }}'
        },
        {
          tag: 'ElButton',
          events: {
            click: {
              type: 'call',
              method: 'toggleTodo',
              params: { index: '{{ idx }}' }
            }
          },
          children: '{{ item.completed ? "撤销" : "完成" }}'
        },
        {
          tag: 'ElButton',
          events: {
            click: {
              type: 'call',
              method: 'deleteTodo',
              params: { index: '{{ idx }}' }
            }
          },
          children: '删除'
        }
      ]
    }
  ]
}

const { vnode, state } = useVario<MyState>(schema, {
  state: {
    todos: [
      { id: 1, text: '学习 Vario', completed: false },
      { id: 2, text: '构建应用', completed: false }
    ]
  },
  methods: {
    toggleTodo: ({ state, params, ctx }) => {
      state.todos[params.index].completed = !state.todos[params.index].completed
      // 通过节点上下文访问兄弟节点
      console.log('Siblings count:', ctx.$siblings?.length)
    },
    deleteTodo: ({ state, params }) => {
      state.todos.splice(params.index, 1)
    }
  }
})
```

### 节点上下文实战（表单联动）

```typescript
interface FormState {
  province: string
  city: string
  area: string
}

const schema: SchemaNode<FormState> = {
  tag: 'ElForm',
  children: [
    {
      tag: 'ElFormItem',
      props: { label: '省份' },
      children: {
        tag: 'ElSelect',
        ref: 'provinceSelect',
        model: { bind: 'province' },
        events: {
          change: 'onProvinceChange'
        },
        children: [
          // ... options
        ]
      }
    },
    {
      tag: 'ElFormItem',
      props: { label: '城市' },
      children: {
        tag: 'ElSelect',
        ref: 'citySelect',
        model: { bind: 'city' },
        props: { disabled: '{{ !province }}' },
        events: {
          change: 'onCityChange'
        }
      }
    },
    {
      tag: 'ElFormItem',
      props: { label: '区域' },
      children: {
        tag: 'ElSelect',
        ref: 'areaSelect',
        model: { bind: 'area' },
        props: { disabled: '{{ !city }}' }
      }
    }
  ]
}

const { vnode, state, refs } = useVario<FormState>(schema, {
  state: { province: '', city: '', area: '' },
  methods: {
    onProvinceChange: ({ state, ctx }) => {
      state.city = ''
      state.area = ''
      // 通过节点上下文重置子级选择器
      const formNode = ctx.$parent  // ElFormItem
      const selectNode = formNode?.$children?.[0]  // ElSelect
      console.log('Form children:', formNode?.$children?.length)
    },
    onCityChange: ({ state }) => {
      state.area = ''
    }
  }
})
})
```

### 计算属性

```typescript
import { computed } from 'vue'

interface MyState {
  firstName: string
  lastName: string
}

const { vnode, state } = useVario<MyState>(schema, {
  state: { firstName: 'John', lastName: 'Doe' },
  computed: {
    // Composition API 风格（推荐）
    fullName: computed(() => state.firstName + ' ' + state.lastName),
    // Options API 风格
    fullNameAlt: (state) => state.firstName + ' ' + state.lastName
  }
})
```

### 模板引用

```typescript
const schema: SchemaNode<MyState> = {
  tag: 'ElInput',
  ref: 'inputRef',
  model: { bind: 'name' }
}

const { vnode, state, refs } = useVario<MyState>(schema, {
  state: { name: '' },
  methods: {
    focusInput: ({ ctx }) => {
      ctx.$refs.inputRef?.focus()  // 访问组件实例方法
    }
  }
})

// 或在组件中访问
refs.inputRef.value?.focus()
```

## 快速参考

### 安装
```bash
pnpm add @variojs/vue @variojs/core @variojs/schema @variojs/types
```

### 最小示例
```typescript
import { useVario } from '@variojs/vue'
import type { SchemaNode } from '@variojs/types'

interface MyState {
  name: string
}

const schema: SchemaNode<MyState> = {
  tag: 'div',
  children: [
    { tag: 'ElInput', model: { bind: 'name' } },
    { tag: 'div', children: '你好，{{ name }}！' }
  ]
}

const { vnode, state } = useVario<MyState>(schema, { 
  state: { name: '' } 
})
```

## 最佳实践

### 1. TypeScript 类型安全
- 定义明确的 State 接口：`interface MyState { ... }`
- 使用泛型参数：`useVario<MyState>(schema, options)`
- SchemaNode 泛型传递：`SchemaNode<MyState>` 自动推导 RuntimeContext 类型
- 方法参数自动推导：ActionConfig 的 params 类型自动匹配方法签名

### 2. 节点上下文优化
- **优先使用节点上下文**：`ctx.$parent/$siblings/$children` 访问相关节点（性能优于 findById）
- **链式访问**：`ctx.$parent.$parent` 访问祖先节点（Proxy 实现，无性能损失）
- **避免过度使用**：仅在需要节点关系时使用，简单场景直接操作 state

### 3. Schema 查询策略
- **findById**：O(1) 查找，适合已知 ID 的场景
- **findAll**：O(n) 遍历，适合复杂条件筛选
- **节点上下文**：适合局部关系访问（父子、兄弟）

### 4. 生命周期管理
- **Schema 钩子**：用于节点级副作用（DOM 操作、数据初始化）
- **组件钩子**：用于全局副作用（WebSocket、订阅）
- **清理副作用**：onUnmounted 中取消订阅、清除定时器、断开连接

### 5. Model 绑定配置
- **惰性模式**：`lazy: true` 仅用户修改后才写 state（减少初始化开销）
- **全局配置**：`modelOptions: { lazy: true }` 设置默认惰性
- **修饰符使用**：trim 去空格、number 转数字、自定义修饰符处理特殊格式

### 6. 事件修饰符优化
- **链式修饰符**：`'click.stop.prevent'` 同时阻止冒泡和默认行为
- **键盘快捷键**：`'keydown.enter.ctrl'` 组合键监听
- **性能修饰符**：`.once` 仅触发一次、`.passive` 提升滚动性能

### 7. 错误处理策略
- **启用错误边界**：`errorBoundary: { enabled: true }` 防止单个节点错误崩溃整个 Schema
- **自定义 Fallback**：提供友好的错误 UI
- **错误恢复**：`retry()` 手动重试渲染

### 8. 性能优化
- **惰性计算**：`stats` 仅在访问时计算（避免不必要开销）
- **减少表达式复杂度**：复杂逻辑移至 computed 或 methods
- **列表渲染 key**：循环中必须提供唯一 key（优化 diff 算法）
- **避免深层嵌套**：过深的 Schema 树影响渲染性能

### 9. 非组件上下文使用
- **传递 app 实例**：`useVario(schema, { app: vueApp })` 使组件解析生效
- **传递 components**：`useVario(schema, { components: { MyComp } })` 注册局部组件

### 10. 模块化 Schema
- **拆分子 Schema**：大型 Schema 拆分为可复用模块
- **动态 Schema**：使用函数或 ComputedRef 实现响应式 Schema
- **Schema 组合**：通过 children 嵌套组合多个 Schema

## 注意事项

- **计算属性**：使用 Vue 的 `computed()` 或函数形式，自动响应 state 变化
- **生命周期钩子**：Schema 节点支持 8 个钩子（onMounted/onUpdated/onUnmounted 等）
- **Model 路径**：支持深层路径 `'user.profile.name'`，自动创建对象结构
- **表达式语法**：`{{ expression }}` 支持完整 JavaScript 表达式
- **组件类型**：支持原生元素（div/input）和 Vue 组件（ElInput/ElButton）
- **修饰符语法**：事件修饰符使用点语法 `'click.stop.prevent'`，model 修饰符使用数组或对象
- **节点上下文**：`$parent` 链式访问通过 Proxy 实现，性能无损

## 详细文档

完整文档请访问 [@variojs 官网](https://variojs.org)：

- **核心概念**：
  - [快速开始](https://variojs.org/guide/quick-start) - 5 分钟上手
  - [状态管理](https://variojs.org/guide/state) - 响应式状态和计算属性
  - [表达式系统](https://variojs.org/guide/expression) - {{ }} 语法和 DSL
  
- **高级特性**：
  - [节点上下文](https://variojs.org/guide/node-context) - $parent/$siblings/$children 访问
  - [Schema 查询](https://variojs.org/guide/schema-query) - findById/findAll 节点查找
  - [控制流](https://variojs.org/guide/control-flow) - 条件渲染和循环
  
- **Vue 集成**：
  - [指令系统](https://variojs.org/guide/directives) - v-focus 等自定义指令
  - [事件处理](https://variojs.org/guide/events) - 事件绑定和修饰符
  - [生命周期](https://variojs.org/packages/vue/lifecycle) - 8 个钩子详解
  - [Vue 特性](https://variojs.org/guide/vue-features) - Refs/Teleport/Transition/KeepAlive
  
- **API 参考**：
  - [useVario](https://variojs.org/api/use-vario) - 完整 API 和选项
  - [类型定义](https://variojs.org/api/types) - @variojs/types 包说明
  
- **性能与最佳实践**：
  - [性能优化](https://variojs.org/guide/performance) - 大规模 Schema 优化策略
  - [Vue 集成最佳实践](https://variojs.org/packages/vue/best-practices) - 14 个场景最佳实践

## TypeScript 类型参考

```typescript
import type {
  // Schema 类型
  SchemaNode,
  SchemaNodeProps,
  SchemaChild,
  
  // Action 类型
  ActionConfig,
  ActionType,
  
  // 修饰符类型
  ModelModifiers,
  EventModifiers,
  EventName,
  
  // 运行时类型
  RuntimeContext,
  MethodContext,
  
  // Vue 集成类型
  UseVarioOptions,
  UseVarioResult,
  VueRendererOptions
} from '@variojs/types'
```
