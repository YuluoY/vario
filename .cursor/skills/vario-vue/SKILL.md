---
name: vario-vue
description: Build Vue 3 applications using @variojs/vue with declarative JSON Schema. Provides bidirectional binding, expressions, loops, Vue features (refs, lifecycle, provide/inject, teleport), and Composition API integration. Use when building Schema-driven Vue components, implementing form components, creating dynamic UIs, working with @variojs/vue, useVario composable, VueSchemaNode, or declarative UI patterns.
---

# Vario Vue Integration

使用 `@variojs/vue` 在 Vue 3 中通过声明式 JSON Schema 构建 UI。

## 何时使用此技能

在以下场景使用此技能：
- 使用 `@variojs/vue` 构建 Vue 组件
- 需要 Schema 驱动的 UI 开发
- 实现表单组件和动态 UI
- 使用 `useVario` composable
- 编写 `VueSchemaNode` 定义
- 需要双向绑定、表达式、循环渲染
- 集成 Vue 特性（refs、生命周期、provide/inject、teleport）

## 核心 API

### useVario

```typescript
import { useVario } from '@variojs/vue'
import type { VueSchemaNode } from '@variojs/vue'

const { vnode, state, ctx, refs, error, retry } = useVario(schema, options)
```

**返回值：**
- `vnode`: `Ref<VNode | null>` - 渲染的 VNode
- `state`: `TState` - 响应式状态（自动同步到 RuntimeContext）
- `ctx`: `Ref<RuntimeContext<TState>>` - 运行时上下文
- `refs`: `Record<string, Ref<any>>` - 模板引用集合
- `error`: `Ref<Error | null>` - 当前错误
- `retry`: `() => void` - 手动重试渲染

**选项：**
```typescript
interface UseVarioOptions<TState> {
  state?: TState                                    // 初始状态
  computed?: Record<string, ((state: TState) => any) | ComputedRef<any>>  // 计算属性
  methods?: Record<string, (ctx: MethodContext<TState>) => any>  // 方法
  modelBindings?: Record<string, any>              // 自定义双向绑定配置
  onEmit?: (event: string, data?: unknown) => void  // 事件处理
  onError?: (error: Error) => void                  // 错误处理
  errorBoundary?: {                                 // 错误边界
    enabled?: boolean
    fallback?: (error: Error) => VNode
    onRecover?: (error: Error) => void
  }
  rendererOptions?: VueRendererOptions              // 渲染器配置
  app?: App                                         // Vue 应用实例
  components?: Record<string, any>                  // 全局组件映射
  exprOptions?: ExpressionOptions                   // 表达式配置
  modelOptions?: { separator?: string; lazy?: boolean }  // Model 绑定配置（路径分隔符、默认惰性）
}
```

## Schema 节点属性

### 基础属性

```typescript
interface VueSchemaNode {
  type: string                    // 组件类型（原生元素或 Vue 组件）
  props?: Record<string, any>     // 组件属性
  children?: string | VueSchemaNode | VueSchemaNode[]  // 子节点
  show?: string | boolean         // 条件显示（表达式或布尔值）
  cond?: {                        // 条件渲染
    if: string                    // 条件表达式
    then: VueSchemaNode
    else?: VueSchemaNode
  }
}
```

### 双向绑定

```typescript
{
  type: 'ElInput',
  model: 'name'                    // 扁平路径
  // 或
  model: 'user.name'              // 嵌套路径（自动创建对象结构）
  // 或
  model: { path: 'user.name', scope: true }  // 作用域模式
  // 或
  model: { path: 'name', default: '张三' }   // 带默认值（状态未初始化时使用）
  // 或
  model: { path: 'optional', lazy: true }    // 惰性：不预写 state，仅用户修改后才写入
}
// 整棵 schema 默认惰性：useVario(schema, { modelOptions: { lazy: true } }) 则所有未显式设置 lazy 的 model 均不预写 state
```

### 循环渲染

```typescript
{
  type: 'div',
  loop: {
    items: '{{ userList }}',      // 数据源（表达式）
    itemKey: 'item',               // 循环变量名
    key?: 'id'                     // 可选：key 字段
  },
  children: '{{ item.name }}'      // 使用循环变量
}
```

### 事件处理

```typescript
{
  type: 'ElButton',
  events: {
    click: {
      type: 'call',                // 调用方法
      method: 'handleClick'        // 方法名（在 methods 中定义）
    }
    // 或
    click: {
      type: 'set',                 // 设置状态
      path: 'count',
      value: '{{ count + 1 }}'
    }
  }
}
```

### 表达式

```typescript
{
  type: 'div',
  children: '{{ firstName + " " + lastName }}',  // 文本插值
  show: 'count > 10',                            // 条件表达式
  props: {
    disabled: '{{ !isValid }}'                   // 属性表达式
  }
}
```

### Vue 特性

**模板引用：**
```typescript
{
  type: 'ElInput',
  ref: 'inputRef'                 // 在 refs.inputRef.value 中访问
}
```

**生命周期：**
```typescript
{
  type: 'div',
  onMounted: 'initData',          // 挂载后调用 methods.initData
  onUnmounted: 'cleanup'
}
```

**Provide/Inject：**
```typescript
// 提供数据
{
  type: 'div',
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
import type { VueSchemaNode } from '@variojs/vue'

const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'ElInput',
      model: 'name',
      props: { placeholder: '请输入姓名' }
    },
    {
      type: 'div',
      children: '你好，{{ name }}！'
    }
  ]
}

export default {
  setup() {
    const { vnode, state } = useVario(schema, {
      state: { name: '' }
    })
    return { vnode, state }
  }
}
```

### 带方法的组件

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'ElButton',
      events: {
        click: {
          type: 'call',
          method: 'handleClick'
        }
      },
      children: '点击'
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: { count: 0 },
  methods: {
    handleClick: ({ state, ctx }) => {
      state.count++
      console.log('Count:', state.count)
    }
  }
})
```

### 循环列表

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  loop: {
    items: '{{ todos }}',
    itemKey: 'item'
  },
  children: [
    {
      type: 'span',
      children: '{{ item.text }}'
    },
    {
      type: 'ElButton',
      events: {
        click: {
          type: 'call',
          method: 'toggleTodo'
        }
      },
      children: '切换'
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: {
    todos: [
      { id: 1, text: '任务1', done: false },
      { id: 2, text: '任务2', done: true }
    ]
  },
  methods: {
    toggleTodo: ({ state, ctx, params }) => {
      const index = params.index
      state.todos[index].done = !state.todos[index].done
    }
  }
})
```

### 计算属性

```typescript
import { computed } from 'vue'

const { vnode, state } = useVario(schema, {
  state: { firstName: 'John', lastName: 'Doe' },
  computed: {
    fullName: computed(() => state.firstName + ' ' + state.lastName)
    // 或 Options 风格
    // fullName: (state) => state.firstName + ' ' + state.lastName
  }
})
```

### 模板引用

```typescript
const schema: VueSchemaNode = {
  type: 'ElInput',
  ref: 'inputRef',
  model: 'name'
}

const { vnode, state, refs } = useVario(schema, {
  state: { name: '' }
})

// 访问组件实例
refs.inputRef.value?.focus()
```

## 快速参考

### 安装
```bash
pnpm add @variojs/vue @variojs/core @variojs/schema
```

### 最小示例
```typescript
import { useVario } from '@variojs/vue'
import type { VueSchemaNode } from '@variojs/vue'

const schema: VueSchemaNode = {
  type: 'div',
  children: [
    { type: 'ElInput', model: 'name' },
    { type: 'div', children: '{{ name }}' }
  ]
}

const { vnode, state } = useVario(schema, { state: { name: '' } })
```

## 最佳实践

1. **状态管理**：使用扁平结构，通过路径访问嵌套数据
2. **方法定义**：在 `methods` 中定义，通过 `MethodContext` 访问 state 和 ctx
3. **计算属性**：使用 Vue 的 `computed()` 或函数形式
4. **生命周期**：在组件中直接使用 Vue 生命周期钩子，而非 Schema 中
5. **错误处理**：配置 `errorBoundary` 处理渲染错误
6. **性能优化**：大量组件时避免在 Schema 中定义生命周期，在组件层面处理

## 注意事项

- `computed` 和 `watch` 应在 Vue 组件中使用原生 API 定义，通过 `computed` 选项传入
- 生命周期钩子应在使用 `useVario` 的组件中直接使用，减少抽象层开销
- Model 路径支持自动创建对象结构，使用 `.` 分隔符
- 表达式使用 `{{ }}` 语法，支持完整的 JavaScript 表达式
- 组件类型可以是原生元素（`div`, `input`）或注册的 Vue 组件（`ElInput`, `ElButton`）

## 详细文档

- **API 参考**：见 [references/api.md](references/api.md)
- **Schema 指南**：见 [references/schema-guide.md](references/schema-guide.md)
- **示例代码**：见 `assets/examples/` 目录
