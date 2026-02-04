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

### 完整配置示例

```typescript
import { useVario } from '@variojs/vue'
import { ref, computed, h, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'

interface FormState {
  username: string
  email: string
  age: number
  items: Array<{ name: string; count: number }>
}

const schema = {
  type: 'ElForm',
  props: {
    model: '{{ $self }}',
    labelWidth: '120px'
  },
  onMounted: 'onFormMounted',
  onUnmounted: 'onFormUnmounted',
  children: [
    {
      type: 'ElFormItem',
      props: { label: '用户名' },
      children: {
        type: 'ElInput',
        model: 'username',
        events: {
          change: 'validateUsername'
        }
      }
    },
    {
      type: 'ElFormItem',
      props: { label: '邮箱' },
      children: {
        type: 'ElInput',
        model: 'email'
      }
    },
    {
      type: 'ElFormItem',
      props: { label: '显示名' },
      children: '{{ displayName }}'
    },
    {
      type: 'ElButton',
      props: { type: 'primary' },
      events: {
        click: 'submitForm'
      },
      children: '提交'
    }
  ]
}

const { vnode, state, ctx, refs, error, retry } = useVario<FormState>(schema, {
  // 初始状态
  state: {
    username: '',
    email: '',
    age: 0,
    items: []
  },
  
  // 计算属性（Options 风格）
  computed: {
    displayName: (state) => `${state.username} (${state.email})`,
    // 或使用 Composition 风格
    itemCount: computed(() => state.items.length)
  },
  
  // 方法定义
  methods: {
    onFormMounted: ({ ctx, state }) => {
      console.log('表单已挂载', ctx, state)
      // 加载初始数据
      state.username = 'admin'
    },
    
    onFormUnmounted: ({ state }) => {
      console.log('表单即将卸载', state)
      // 清理资源
    },
    
    validateUsername: ({ state, value }) => {
      if (!state.username) {
        ElMessage.error('用户名不能为空')
      }
      console.log('输入值:', value)
    },
    
    async submitForm({ state, ctx }) {
      // 异步提交
      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          body: JSON.stringify(state)
        })
        const data = await response.json()
        ElMessage.success('提交成功')
        return data
      } catch (error) {
        ElMessage.error('提交失败')
        throw error
      }
    }
  },
  
  // 表达式选项
  exprOptions: {
    allowedGlobals: ['Math', 'Date'],
    maxDepth: 10
  },
  
  // 自定义 model 绑定
  modelBindings: {
    'CustomInput': {
      prop: 'value',
      event: 'update:value'
    }
  },
  
  // Model 配置
  modelOptions: {
    separator: '.',
    lazy: false
  },
  
  // 错误边界配置
  errorBoundary: {
    enabled: true,
    fallback: (error) => {
      return h('div', { style: { color: 'red' } }, [
        h('h3', '渲染失败'),
        h('p', error.message),
        h('button', { onClick: retry }, '重试')
      ])
    },
    onRecover: (error) => {
      console.error('错误恢复:', error)
    }
  },
  
  // 事件发射
  onEmit: (event, data) => {
    console.log('事件:', event, '数据:', data)
  },
  
  // 错误处理
  onError: (error) => {
    console.error('错误:', error)
  }
})

// 使用返回值
watchEffect(() => {
  console.log('状态:', state)
  console.log('上下文:', ctx.value)
  console.log('错误:', error.value)
})
```

### 在非组件上下文中使用

当在组件外部使用 `useVario` 时（如 Pinia store），需要传递 `app` 或 `components`：

```typescript
import { useVario } from '@variojs/vue'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'

// 创建 Vue 应用
const app = createApp({})
app.use(ElementPlus)

// 方式 1：传递 app 实例
const { vnode } = useVario(schema, {
  state: { count: 0 },
  app  // 自动获取全局注册的组件
})

// 方式 2：直接传递组件映射
import { ElButton, ElInput } from 'element-plus'

const { vnode } = useVario(schema, {
  state: { count: 0 },
  components: {
    ElButton,
    ElInput
  }
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

## 高级用法

### 动态 Schema

```typescript
const schemaRef = computed(() => {
  if (state.mode === 'edit') {
    return editSchema
  }
  return viewSchema
})

const { vnode } = useVario(schemaRef, {
  state: { mode: 'view' }
})
```

### Schema 函数

```typescript
const { vnode } = useVario(() => {
  // 动态生成 Schema
  return {
    type: 'div',
    children: state.items.map(item => ({
      type: 'span',
      children: item.name
    }))
  }
}, {
  state: { items: [] }
})
```

### 获取组件实例引用

```typescript
const schema = {
  type: 'ElForm',
  ref: 'myForm',  // 设置 ref
  children: [/* ... */]
}

const { refs } = useVario(schema)

// 访问组件实例
watchEffect(() => {
  const formRef = refs.myForm
  if (formRef.value) {
    // 调用组件方法
    formRef.value.validate()
  }
})
```

### Schema 统计信息

```typescript
const { stats } = useVario(schema)

watchEffect(() => {
  console.log('节点总数:', stats.value.nodeCount)
  console.log('最大深度:', stats.value.maxDepth)
})
```

### 错误恢复

```typescript
const { error, retry } = useVario(schema, {
  errorBoundary: { enabled: true }
})

// 监听错误
watch(error, (err) => {
  if (err) {
    console.error('渲染错误:', err)
    // 5秒后自动重试
    setTimeout(() => retry(), 5000)
  }
})
```

## TypeScript 类型推导

`useVario` 提供完整的类型推导：

```typescript
interface MyState {
  name: string
  count: number
  items: Array<{ id: string }>
}

const { state, ctx } = useVario<MyState>(schema, {
  state: { name: '', count: 0, items: [] },
  methods: {
    // ctx 和 state 自动推导类型
    handleClick: ({ ctx, state }) => {
      state.count++  // ✅ 类型安全
      ctx.$self?.model  // ✅ 推导为 keyof MyState | undefined
      ctx.$parent?.loop?.items  // ✅ 完整的类型提示
    }
  }
})

// state 是响应式的，且类型为 MyState
state.name = 'test'  // ✅
state.invalid = 'x'  // ❌ 类型错误
```

## 性能优化

### 惰性分析

`useVario` 默认使用惰性分析，只在需要时才分析 Schema 结构：

```typescript
const { stats, findById } = useVario(schema)

// stats 是惰性计算的，首次访问时才分析
console.log(stats.value.nodeCount)  // 触发分析

// 后续访问使用缓存
console.log(stats.value.maxDepth)  // 使用缓存
```

### 渲染调度

状态变化会自动调度渲染，防止同一 tick 内多次渲染：

```typescript
const { state } = useVario(schema)

// 多次修改只触发一次渲染
state.count++
state.name = 'test'
state.items.push({ id: '1' })
// 在 nextTick 时统一渲染
```

### 深度监听优化

```typescript
const { state } = useVario(schema, {
  state: { 
    largeArray: new Array(10000).fill(0) 
  }
})

// 使用 flush: 'sync' 确保状态同步在渲染前完成
// 内部自动处理，无需手动配置
```

## 注意事项

1. **状态响应式**：传入的 `state` 会自动转换为响应式对象（如果还不是）
2. **计算属性优先级**：计算属性会覆盖同名的初始状态
3. **方法别名**：方法支持多种调用方式（`methodName`、`$methods.methodName`、`methods.methodName`、`services.methodName`）
4. **循环检测**：内置状态同步的循环检测，防止死循环
5. **组件上下文**：在组件内使用时自动获取当前实例，在组件外需要传递 `app` 或 `components`
6. **生命周期**：Schema 中的生命周期钩子（`onMounted`、`onUnmounted` 等）会映射到对应的 methods

## 相关文档

- [Schema 查询指南](/guide/schema-query) - 完整的查询功能说明
- [Vue 生命周期](/packages/vue/lifecycle) - 生命周期钩子详解
- [节点上下文](/guide/node-context) - 访问父节点、兄弟节点
- [Core Schema API](/packages/core/schema-utilities) - 框架无关的核心 API
- [类型定义](/api/types) - 完整的 TypeScript 类型