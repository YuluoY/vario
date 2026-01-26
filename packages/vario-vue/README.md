# @vario/vue

Vario Vue Renderer - 深度集成 Vue 3 的 Schema 渲染器

## 简介

`@vario/vue` 是 Vario Schema 的 Vue 3 集成层，将声明式的 JSON Schema 转换为 Vue 组件树。它深度集成 Vue 3 的 Composition API，提供完整的 Vue 特性支持，同时保持 Schema 的简洁性和可维护性。

### 设计理念

- **Schema 只负责结构**：Schema 定义 UI 结构、属性绑定、事件映射
- **Vue 负责响应式逻辑**：computed、watch 等响应式特性使用 Vue 原生 API
- **声明映射而非重新实现**：ref、生命周期、provide/inject 等通过声明映射到 Vue 原生 API
- **自动响应式同步**：state 自动包裹为响应式对象，支持层级依赖收集

## 安装

```bash
npm install @vario/vue @vario/core @vario/schema
# 或
pnpm add @vario/vue @vario/core @vario/schema
```

## 快速开始

```typescript
import { useVario } from '@vario/vue'
import type { VueSchemaNode } from '@vario/vue'

const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'name',
      props: { placeholder: '请输入姓名' }
    },
    {
      type: 'div',
      children: '{{ name }}'
    }
  ]
}

export default {
  setup() {
    const { vnode, state } = useVario(schema, {
      state: {
        name: ''
      }
    })
    
    return { vnode, state }
  }
}
```

## 核心概念

### 状态管理

`useVario` 会自动将传入的 `state` 包裹为 Vue 的响应式对象（`reactive`），并建立与运行时上下文（`RuntimeContext`）的双向同步。

```typescript
const { state, ctx } = useVario(schema, {
  state: {
    user: {
      name: 'John',
      age: 30
    }
  }
})

// state 是响应式的
state.user.name = 'Jane'  // ✅ Vue 会自动追踪变化

// 也可以通过 ctx 访问
ctx._get('user.name')  // 'Jane'
ctx._set('user.age', 31)  // ✅ 会同步到 state.user.age
```

### Model 双向绑定与依赖收集

**关键特性：会根据层级自动收集依赖**

当你在 Schema 中使用 `model` 双向绑定时，Vario 会：

1. **自动追踪嵌套路径**：使用 Vue 的 Proxy 响应式系统追踪深层属性访问
2. **双向同步**：`ctx._set` 的变化会通过 `onStateChange` 同步到 `reactiveState`
3. **层级依赖收集**：Vue 会自动追踪所有访问的嵌套路径

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'user.profile.name',  // 深层路径
      props: { placeholder: '姓名' }
    },
    {
      type: 'input',
      model: 'user.profile.email',  // 另一个深层路径
      props: { placeholder: '邮箱' }
    },
    {
      type: 'div',
      children: '{{ user.profile.name }} - {{ user.profile.email }}'
    }
  ]
}

const { state } = useVario(schema, {
  state: {
    user: {
      profile: {
        name: '',
        email: ''
      }
    }
  }
})

// 当用户在输入框中输入时：
// 1. 触发 update:modelValue 事件
// 2. 调用 ctx._set('user.profile.name', newValue)
// 3. 触发 onStateChange 回调
// 4. 通过 setPathValue 更新 reactiveState.user.profile.name
// 5. Vue 检测到变化，自动更新所有依赖该路径的组件
//    - 包括显示 {{ user.profile.name }} 的 div
//    - 包括绑定 model: 'user.profile.name' 的 input（值同步）
```

**依赖收集机制详解**：

```typescript
// 在 bindings.ts 中
const value = getPathValue(getState(), modelPath)
// getState() 返回 reactiveState（Vue 响应式对象）
// 当 Vue 组件访问 reactiveState.user.profile.name 时
// Vue 的 Proxy 会自动追踪这个嵌套路径的依赖

// 在 composable.ts 中
onStateChange: (path: string, value: unknown) => {
  setPathValue(
    reactiveState,
    path,  // 'user.profile.name'
    value,
    { 
      createObject: () => reactive({}),  // 中间对象也是响应式的
      createArray: () => reactive([])
    }
  )
}
// 这样确保了整个路径链都是响应式的
// reactiveState.user → reactive
// reactiveState.user.profile → reactive
// reactiveState.user.profile.name → 值
```

**示例：深层嵌套绑定**

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'form.user.profile.contact.phone',  // 4 层嵌套
      props: { placeholder: '电话' }
    },
    {
      type: 'div',
      children: '{{ form.user.profile.contact.phone }}'
    }
  ]
}

const { state } = useVario(schema, {
  state: {
    form: {
      user: {
        profile: {
          contact: {
            phone: ''
          }
        }
      }
    }
  }
})

// ✅ 所有层级都会自动收集依赖
// ✅ 修改 state.form.user.profile.contact.phone 会触发更新
// ✅ 在输入框中输入会同步到 state
```

#### 自动路径解析与状态创建

Vario 支持智能的 model 路径解析，可以自动拼接扁平路径，并自动创建缺失的状态结构。行为完全由 **model 的写法** 决定。

**model 的几种形式**

| 写法 | 是否压栈 | 是否在本节点绑定 | 典型用途 |
|------|----------|------------------|----------|
| **字符串路径** `model: "form"` | 压栈 | 绑定 | 普通表单项、嵌套路径根 |
| **字符串** `model: "."` | 不压栈（用现有栈） | 栈非空时绑定到「当前栈路径」 | 循环中绑定到 `items[0]`、`items[1]` 等数组元素本身 |
| **对象** `model: { path: "form", scope: true }` | 压栈 `path` | **不**绑定 | 仅作层级的容器（如表单根、区块） |

子节点的扁平路径会自动与父级路径栈（来自字符串 `model` 或 `model: { path, scope: true }`）拼接：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  model: { path: 'form', scope: true },  // 父级仅作作用域，不绑定
  children: [
    {
      type: 'input',
      model: 'name'  // 扁平路径 → 自动变成 form.name
    },
    {
      type: 'input',
      model: 'email'  // 扁平路径 → 自动变成 form.email
    },
    {
      type: 'div',
      model: { path: 'user', scope: true },  // 再压一层 user，不绑定
      children: [
        {
          type: 'input',
          model: 'age'  // 扁平路径 → 自动变成 form.user.age
        }
      ]
    }
  ]
}

const { state } = useVario(schema, {
  state: {}  // 空状态，会自动创建结构
})

// ✅ state.form.name 会被自动创建
// ✅ state.form.email 会被自动创建
// ✅ state.form.user.age 会被自动创建
```

**使用 scope 的容器（仅作用域、不绑定）**

希望某节点只提供路径层级、自身不参与绑定时，使用对象形式并设置 `scope: true`：

```typescript
const schema: VueSchemaNode = {
  type: 'form',
  model: { path: 'form', scope: true },  // 仅作用域，不绑定
  children: [
    { type: 'input', model: 'name' },   // → form.name
    { type: 'input', model: 'email' }   // → form.email
  ]
}
// ✅ 根节点不会对 state.form 做 v-model，仅子节点绑定 form.name / form.email
```

**明确路径**

使用完整路径时，不会进行拼接，直接使用。容器建议用 `scope`，避免对 div 建立 v-model：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  model: { path: 'form', scope: true },  // 容器用 scope，不绑定
  children: [
    {
      type: 'input',
      model: 'form.user.name'  // 明确路径，直接使用
    },
    {
      type: 'input',
      model: 'name'  // 扁平路径，拼接成 form.name
    }
  ]
}
```

**数组访问语法 `[]`**

使用 `[]` 语法可以明确指定数组访问，系统会自动创建数组结构：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'users[0].name'  // 使用 [] 语法明确数组访问
    },
    {
      type: 'input',
      model: 'users[1].email'  // 另一个数组项
    }
  ]
}

const { state } = useVario(schema, {
  state: {}  // 空状态
})

// ✅ state.users 会被自动创建为数组
// ✅ state.users[0].name 会被自动创建
// ✅ state.users[1].email 会被自动创建
```

**嵌套数组和对象**

支持复杂的嵌套结构：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'data.users[0].profile.tags[1]'  // 混合嵌套
    }
  ]
}

// ✅ 自动创建结构：
// state.data (对象)
//   → state.data.users (数组)
//     → state.data.users[0] (对象)
//       → state.data.users[0].profile (对象)
//         → state.data.users[0].profile.tags (数组)
//           → state.data.users[0].profile.tags[1] (值)
```

**循环中的自动路径解析**

在循环中，扁平路径会自动拼接循环索引。循环层用 `scope` 提供数组路径，避免对容器做 v-model：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  model: { path: 'users', scope: true },  // 循环层用 scope，不绑定
  loop: {
    items: '{{ users }}',
    itemKey: 'user'
  },
  children: [
    {
      type: 'input',
      model: 'name'  // 扁平路径 → 自动变成 users[0].name, users[1].name...
    },
    {
      type: 'input',
      model: 'age'   // 扁平路径 → 自动变成 users[0].age, users[1].age...
    }
  ]
}

const { state } = useVario(schema, {
  state: {
    users: [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 }
    ]
  }
})

// ✅ 每个循环项都会正确绑定到对应的数组索引
```

**绑定到数组元素本身（`model: "."`）**

当希望「子组件输入值」直接作为数组元素（`state.items[0]`、`state.items[1]` 为字符串等原始值），而不是 `items[i].xxx` 的对象的字段时，在循环内使用 **`model: "."`**，表示绑定到当前路径栈对应的路径（即当前循环项在 state 中的位置）：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  loop: { items: 'items', itemKey: 'it' },
  model: { path: 'items', scope: true },
  children: [
    { type: 'input', model: '.' }  // 绑定到 items[0]、items[1] 本身
  ]
}

const { state } = useVario(schema, {
  state: { items: ['', ''] }
})

// 第 1 行输入 "a" → state.items[0] === 'a'
// 第 2 行输入 "b" → state.items[1] === 'b'
// state.items 为字符串数组，不是对象数组
```

使用 `model: "."` 时，当前路径栈必须非空（例如在带 `model: { path, scope: true }` 的循环下）才会创建绑定。

**循环中嵌套的 model 路径栈**

循环中可以嵌套多层；每层容器用 `scope` 只提供路径、不绑定：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  model: { path: 'data', scope: true },  // 容器用 scope
  loop: {
    items: '{{ data.items }}',
    itemKey: 'item'
  },
  children: [
    {
      type: 'div',
      model: { path: 'item.profile', scope: true },  // 相对循环项压栈，不绑定
      children: [
        {
          type: 'input',
          model: 'name'  // 扁平路径 → data.items[0].profile.name
        }
      ]
    }
  ]
}
```

**modelPath 配置选项**

仅保留与格式相关的配置（如路径分隔符），路径解析与绑定行为由 model 写法决定，无需开关：

```typescript
const { state } = useVario(schema, {
  modelPath: {
    separator: '.'  // 路径分隔符（默认 '.'）
  },
  state: {}
})
```

**智能类型推断**

系统会根据路径结构自动推断并创建数组或对象：

- 使用 `[]` 语法或路径中包含数字索引 → 创建数组
- 使用 `.` 语法或字符串键 → 创建对象
- 默认情况下，纯数字段（如 `users.0.name`）会被视为数组索引

```typescript
// 自动创建数组
model: 'users[0].name'  → state.users = []

// 自动创建对象
model: 'user.profile.name'  → state.user = {}, state.user.profile = {}

// 混合结构
model: 'data.users[0].profile.tags[1]'
  → state.data = {}
  → state.data.users = []
  → state.data.users[0] = {}
  → state.data.users[0].profile = {}
  → state.data.users[0].profile.tags = []
```

**路径语法与 model 写法总结**

| 类型 | 示例 | 说明 | 自动创建 |
|------|------|------|---------|
| 扁平路径 | `model: "name"` | 单段路径，自动拼接父级路径栈 | ✅ 对象 |
| 明确路径 | `model: "form.user.name"` | 完整路径，直接使用 | ✅ 对象 |
| 当前栈路径 | `model: "."` | 绑定到当前路径栈（循环中即 `items[0]`、`items[1]` 等元素本身）；栈非空时有效 | ✅ 按栈推断 |
| 作用域（不绑定） | `model: { path: "form", scope: true }` | 仅压栈，本节点不绑定；子节点扁平路径拼在 `path` 下 | — |
| 数组访问 `[]` | `model: "users[0].name"` | 明确数组索引访问 | ✅ 数组 |
| 动态索引 `[]` | `model: "users[].name"` | 循环中自动填充索引 | ✅ 数组 |
| 点语法数字 | `model: "users.0.name"` | 纯数字段视为数组索引 | ✅ 数组 |
| 混合嵌套 | `model: "data[0].items[1].value"` | 数组和对象混合 | ✅ 自动推断 |

**最佳实践**

1. **使用 `[]` 语法明确数组访问**：`users[0].name` 比 `users.0.name` 更清晰
2. **扁平路径用于层级结构**：在父级定义 `model` 后，子级使用扁平路径自动拼接
3. **明确路径用于跨层级访问**：需要访问非直接父级时使用完整路径
4. **循环中利用自动索引**：在循环中使用扁平路径，系统会自动添加索引

### 表达式系统

Schema 中支持表达式语法，使用 `{{ }}` 包裹：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'div',
      children: '{{ firstName + " " + lastName }}'  // 字符串拼接
    },
    {
      type: 'div',
      children: '{{ count * 2 }}'  // 数学运算
    },
    {
      type: 'div',
      show: 'count > 10',  // 条件显示
      children: 'Count is greater than 10'
    }
  ]
}
```

表达式会在 Vue 的响应式上下文中求值，自动追踪依赖。

## Vue 特性集成

### Ref 模板引用

在 Schema 中声明 `ref`，通过 `useVario` 返回的 `refs` 对象访问组件实例。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'ElInput',
      ref: 'inputRef',  // 声明 ref
      props: {
        modelValue: '{{ inputValue }}'
      }
    },
    {
      type: 'ElButton',
      events: {
        click: {
          type: 'call',
          method: 'focusInput'
        }
      },
      children: '聚焦输入框'
    }
  ]
}

const { refs, methods } = useVario(schema, {
  state: { inputValue: '' },
  methods: {
    focusInput: () => {
      refs.inputRef.value?.focus()  // ✅ 访问组件实例
    }
  }
})
```

### 生命周期钩子

在 Schema 中声明生命周期钩子方法名，精确控制每个组件的生命周期。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  onMounted: 'initData',      // 挂载后
  onUnmounted: 'cleanup',     // 卸载前
  onUpdated: 'onUpdate',      // 更新后
  onBeforeMount: 'beforeInit', // 挂载前
  onBeforeUnmount: 'beforeCleanup', // 卸载前
  onBeforeUpdate: 'beforeUpdate',  // 更新前
  children: 'Content'
}

const { methods } = useVario(schema, {
  state: {},
  methods: {
    initData: ({ state, ctx }) => {
      console.log('组件已挂载')
      // 初始化逻辑
    },
    cleanup: ({ state, ctx }) => {
      console.log('组件即将卸载')
      // 清理逻辑
    }
  }
})
```

**注意**：生命周期钩子映射到 Vue 原生 API，不是重新实现。

### Provide/Inject 依赖注入

在 Schema 中声明 `provide` 和 `inject`，实现组件间的数据传递。

```typescript
// 父组件 Schema
const parentSchema: VueSchemaNode = {
  type: 'div',
  provide: {
    theme: 'dark',
    locale: 'currentLocale',  // 表达式：从状态读取
    apiUrl: 'https://api.example.com'  // 静态值
  },
  children: [
    {
      type: 'ChildComponent'
    }
  ]
}

// 子组件 Schema
const childSchema: VueSchemaNode = {
  type: 'div',
  // 数组形式
  inject: ['theme', 'locale'],
  // 或对象形式
  // inject: {
  //   myTheme: 'theme',
  //   appLocale: { from: 'locale', default: 'en-US' }
  // },
  children: [
    {
      type: 'div',
      children: 'Theme: {{ theme }}, Locale: {{ locale }}'
    }
  ]
}
```

### Teleport 传送

将组件传送到指定的 DOM 节点。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'ElDialog',
      teleport: 'body',  // 传送到 body
      props: {
        modelValue: '{{ dialogVisible }}'
      },
      children: '对话框内容'
    }
  ]
}
```

### Transition 过渡动画

为组件添加过渡效果。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  transition: 'fade',  // 简单形式
  // 或完整配置
  // transition: {
  //   name: 'fade',
  //   appear: true,
  //   mode: 'out-in',
  //   duration: { enter: 300, leave: 200 }
  // },
  children: 'Content'
}
```

### Keep-Alive 缓存

缓存组件状态。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  keepAlive: true,
  // 或完整配置
  // keepAlive: {
  //   include: 'ComponentA',
  //   exclude: 'ComponentB',
  //   max: 10
  // },
  children: 'Content'
}
```

## Computed 和 Watch

**重要**：`computed` 和 `watch` **不在 Schema 中定义**，应该在 Vue 组件中使用原生 API 定义。

### Computed 计算属性

```typescript
import { computed } from 'vue'

const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'div',
      children: '{{ fullName }}'  // 使用 computed
    }
  ]
}

const state = reactive({
  firstName: 'John',
  lastName: 'Doe'
})

// ✅ 使用 Vue 原生 computed
const fullName = computed(() => state.firstName + ' ' + state.lastName)

const { vnode } = useVario(schema, {
  state,
  computed: {
    fullName  // 传入 Vue ComputedRef
  }
})
```

### Watch 监听器

```typescript
import { watch } from 'vue'

const state = reactive({
  count: 0,
  user: { name: 'John' }
})

// ✅ 使用 Vue 原生 watch
watch(() => state.count, (newVal, oldVal) => {
  console.log('Count changed:', newVal, '->', oldVal)
})

watch(() => state.user.name, (newVal) => {
  console.log('User name changed:', newVal)
}, { immediate: true, deep: true })

const { vnode } = useVario(schema, {
  state
})
```

**为什么不在 Schema 中定义？**

- 避免重新实现 Vue 的响应式系统
- 利用 Vue 的编译优化
- 保持与 Vue 生态的一致性
- 更好的类型推导和 IDE 支持

## 控制流

### 条件渲染

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  cond: 'isVisible',  // 条件渲染（v-if）
  // 或
  show: 'isVisible',  // 条件显示（v-show）
  children: 'Content'
}
```

### 循环渲染

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  loop: {
    items: '{{ userList }}',  // 数据源
    itemKey: 'item',          // 项变量名
    indexKey: 'index'         // 索引变量名（可选）
  },
  children: [
    {
      type: 'div',
      children: '{{ index + 1 }}. {{ item.name }}'
    }
  ]
}
```

## 事件处理

```typescript
const schema: VueSchemaNode = {
  type: 'ElButton',
  events: {
    click: {
      type: 'call',
      method: 'handleClick'
    }
  },
  children: '点击'
}

const { methods } = useVario(schema, {
  state: {},
  methods: {
    handleClick: ({ state, ctx, event }) => {
      console.log('Button clicked', event)
    }
  }
})
```

## API 参考

### useVario

```typescript
function useVario<TState extends Record<string, unknown>>(
  schema: Schema<TState> | (() => Schema<TState>) | ComputedRef<Schema<TState>>,
  options?: UseVarioOptions<TState>
): UseVarioResult<TState>
```

#### Options

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
  
  /** Model 路径解析配置（可选，仅与格式相关如 separator） */
  modelPath?: {
    /** 路径分隔符（默认 '.'） */
    separator?: string
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

#### 返回值

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
  
  /** 手动触发重新渲染 */
  retry: () => void
}
```

## 性能优化

### 大规模渲染

- **组件解析缓存**：相同类型的组件只解析一次
- **静态属性缓存**：静态属性会被缓存，避免重复计算
- **事件处理器缓存**：事件处理器会被缓存，避免重复创建
- **循环上下文池**：复用循环上下文对象，减少内存分配

### 响应式优化

- **深度比较**：状态同步时进行深度比较，避免不必要的更新
- **路径追踪**：使用路径追踪避免循环同步
- **批量更新**：使用 `nextTick` 批量处理状态变化

### 最佳实践

1. **使用虚拟滚动**：对于大型列表（> 1000 项），使用虚拟滚动组件
2. **静态节点标记**：对于不会变化的节点，考虑使用静态提升
3. **合理使用 computed**：在组件层面定义 computed，利用 Vue 的缓存机制
4. **避免深层嵌套**：虽然支持深层嵌套，但建议控制在 3-4 层以内

## 类型支持

```typescript
import type { VueSchemaNode } from '@vario/vue'

// VueSchemaNode 扩展了 SchemaNode，添加了 Vue 特有属性
const schema: VueSchemaNode = {
  type: 'div',
  ref: 'container',
  onMounted: 'init',
  // ... 其他属性
}
```

## 示例

查看 `@play/src/examples/` 目录下的完整示例。

## 许可证

MIT
