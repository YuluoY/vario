# 性能优化

本章介绍 @variojs/vue 提供的渲染优化特性，帮助你在大规模应用中获得更好的性能。

## 概述

vario-vue 提供了四个主要的性能优化选项，可通过 `rendererOptions` 配置：

```typescript
const { vnode, state } = useVario(schema, {
  rendererOptions: {
    usePathMemo: true,           // 路径缓存（默认启用）
    loopItemAsComponent: false,  // 列表项组件化（按需启用）
    
    // 方案 C：子树组件化（v0.4.0 新增）
    subtreeComponent: {
      enabled: false,            // 默认关闭
      granularity: 'boundary',   // 'all' | 'boundary'
      maxDepth: undefined        // 可选深度限制
    },
    
    // 方案 D：Schema 碎片化（v0.4.0 新增）
    schemaFragment: {
      enabled: false,            // 默认关闭
      granularity: 'node'        // 'node' | 'component'
    }
  }
})
```

### 优化方案对比

| 优化方案 | 适用场景 | 加速倍数 | 默认状态 |
|----------|----------|----------|----------|
| **path-memo** | 表达式密集、静态子树 | 2-88x 🔥 | 启用 |
| **loopItemAsComponent** | 长列表单项更新 | 4-29x 🔥 | 关闭 |
| **subtreeComponent** | 大规模/深嵌套 UI | 2-12x | 关闭 |
| **schemaFragment** | 精确 Schema 更新 | 按需 | 关闭 |

---

## path-memo（路径缓存）

### 什么是 path-memo

path-memo 是一种渲染缓存优化，通过缓存每个节点路径对应的 VNode，当状态更新时，只重新渲染发生变化的分支，其他分支直接复用缓存。

### 何时使用

适合以下场景：
- Schema 中有大量静态节点（不依赖状态）
- 使用了复杂的表达式计算
- 表单、表格等结构固定的页面
- 状态更新频繁但影响范围小

### 如何启用

path-memo **默认已启用**，无需额外配置：

```typescript
const { vnode, state } = useVario(schema, {
  // path-memo 默认开启
  rendererOptions: {
    usePathMemo: true  // 默认值
  }
})
```

如需关闭（不推荐）：

```typescript
const { vnode, state } = useVario(schema, {
  rendererOptions: {
    usePathMemo: false
  }
})
```

### 实际应用示例

#### 示例 1：静态子树场景

```typescript
const schema = {
  type: 'div',
  children: [
    // 静态头部（不依赖状态，会被缓存）
    {
      type: 'header',
      children: [
        { type: 'h1', children: 'My App' },
        { type: 'nav', children: [...] }
      ]
    },
    // 动态内容（依赖 counter）
    {
      type: 'div',
      children: 'Count: {{ counter }}'
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: { counter: 0 }
})

// 更新 counter 时，header 部分直接复用缓存，不重新渲染
state.counter++
```

#### 示例 2：表达式密集场景

```typescript
const schema = {
  type: 'div',
  children: [
    { type: 'div', children: '{{ user.firstName + " " + user.lastName }}' },
    { type: 'div', children: '{{ user.age >= 18 ? "Adult" : "Minor" }}' },
    { type: 'div', children: '{{ user.email.toLowerCase() }}' },
    // ... 更多表达式节点
  ]
}

// path-memo 会缓存每个表达式节点的计算结果
// 当 user 不变时，所有表达式节点都复用缓存
```

---

## loopItemAsComponent（列表项组件化）

### 什么是 loopItemAsComponent

loopItemAsComponent 将循环中的每一项包装为独立的 Vue 组件。当列表中某一项数据变化时，Vue 只重新渲染该项组件，其他项完全跳过渲染。

### 何时使用

适合以下场景：
- 长列表（100+ 项）且频繁更新单项
- Todo List、购物车等单项操作场景
- 表格行内编辑
- 列表项包含复杂组件（如 Element Plus 组件）

**不适合**：列表数据整体替换（如搜索、筛选）

### 如何启用

loopItemAsComponent **默认关闭**，需手动启用：

```typescript
const { vnode, state } = useVario(schema, {
  rendererOptions: {
    loopItemAsComponent: true
  }
})
```

### 实际应用示例

#### 示例 1：Todo List

```typescript
const schema = {
  type: 'div',
  children: [
    {
      type: 'div',
      loop: {
        items: '{{ todos }}',
        itemKey: 'item'
      },
      props: {
        key: '{{ item.id }}',  // 确保有稳定的 key
        class: { done: '{{ item.done }}' }
      },
      children: [
        {
          type: 'ElCheckbox',
          model: 'item.done',  // 修改 done 只重渲染该项
          children: '{{ item.text }}'
        },
        {
          type: 'ElButton',
          events: {
            click: {
              type: 'call',
              method: 'deleteTodo',
              args: ['{{ item.id }}']
            }
          },
          children: '删除'
        }
      ]
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: {
    todos: [
      { id: 1, text: 'Learn Vario', done: false },
      { id: 2, text: 'Build App', done: false }
    ]
  },
  rendererOptions: {
    loopItemAsComponent: true  // 启用列表项组件化
  },
  methods: {
    deleteTodo: ({ state }, id) => {
      state.todos = state.todos.filter(t => t.id !== id)
    }
  }
})

// 切换某个 todo 的 done 状态时，只重渲染该项
state.todos[0].done = true
```

#### 示例 2：表格行编辑

```typescript
const schema = {
  type: 'ElTable',
  props: { data: '{{ users }}' },
  children: [
    {
      type: 'ElTableColumn',
      props: { label: '姓名' },
      children: [
        {
          type: 'ElInput',
          model: 'row.name',  // 编辑时只重渲染该行
          props: { size: 'small' }
        }
      ]
    },
    // ... 更多列
  ]
}

const { vnode, state } = useVario(schema, {
  state: {
    users: [
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob', age: 30 }
      // ... 更多行
    ]
  },
  rendererOptions: {
    loopItemAsComponent: true
  }
})
```

---

## 组合使用

### 同时启用多种优化

对于复杂应用，**推荐同时启用** path-memo 和 loopItemAsComponent：

```typescript
const { vnode, state } = useVario(schema, {
  components: { ElButton, ElInput, ElTable, ElForm },
  rendererOptions: {
    usePathMemo: true,           // 缓存静态节点
    loopItemAsComponent: true    // 优化列表更新
  }
})
```

---

## subtreeComponent（子树组件化）

> v0.4.0 新增

### 什么是 subtreeComponent

subtreeComponent（方案 C）将 Schema 树中符合条件的节点渲染为独立的 Vue 组件 `VarioNode`。当节点的 props 未变化时，Vue 会自动跳过该子树的 re-render，实现更精细的渲染控制。

### 何时使用

适合以下场景：
- 超大规模 UI（5000+ 节点）
- 深度嵌套结构（10+ 层）
- 需要精确控制渲染范围的复杂应用
- 配合其他优化方案使用

### 如何启用

```typescript
const { vnode, state } = useVario(schema, {
  rendererOptions: {
    subtreeComponent: {
      enabled: true,           // 启用子树组件化
      granularity: 'boundary', // 组件化粒度
      maxDepth: 10             // 可选：最大深度限制
    }
  }
})
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | false | 是否启用 |
| `granularity` | 'all' \| 'boundary' | 'boundary' | 组件化粒度 |
| `maxDepth` | number | undefined | 最大组件化深度 |

#### granularity 选项

- **`'all'`**：所有节点都组件化
  - 优点：最细粒度的渲染控制
  - 缺点：组件数量多，有一定开销

- **`'boundary'`**（推荐）：仅在组件边界组件化
  - 首字母大写的组件（如 `ElButton`、`MyComponent`）
  - 有 `loop` 属性的节点
  - 有生命周期钩子的节点（`onMounted` 等）

### 实际应用示例

#### 示例 1：大规模仪表盘

```typescript
const schema = {
  type: 'div',
  props: { class: 'dashboard' },
  children: [
    // 头部导航（组件边界，会被组件化）
    { type: 'AppHeader', children: [...] },
    
    // 侧边栏
    { type: 'AppSidebar', children: [...] },
    
    // 主内容区（包含大量嵌套）
    {
      type: 'main',
      children: [
        // 每个 Widget 是组件边界
        { type: 'StatsWidget', props: { data: '{{ stats }}' } },
        { type: 'ChartWidget', props: { data: '{{ chartData }}' } },
        // ... 更多 widgets
      ]
    }
  ]
}

const { vnode, state } = useVario(schema, {
  rendererOptions: {
    subtreeComponent: {
      enabled: true,
      granularity: 'boundary'  // 只在组件边界组件化
    }
  }
})

// 更新 stats 时，只有 StatsWidget 重新渲染
state.stats = { ... }
```

#### 示例 2：深度嵌套表单

```typescript
const schema = {
  type: 'ElForm',
  children: [
    {
      type: 'ElFormItem',
      children: [{
        type: 'ElCard',
        children: [{
          type: 'ElFormItem',
          children: [{
            // 深度嵌套...
          }]
        }]
      }]
    }
  ]
}

const { vnode, state } = useVario(schema, {
  rendererOptions: {
    subtreeComponent: {
      enabled: true,
      granularity: 'boundary',
      maxDepth: 5  // 限制组件化深度，避免过深的组件嵌套
    }
  }
})
```

### 性能对比

| 场景 | 基线 | subtreeComponent | 提升 |
|------|------|------------------|------|
| 5000 扁平节点 | 0.13ms | 0.08ms | 🚀 1.58x |
| 10000 扁平节点 | 0.18ms | 0.16ms | 🚀 1.18x |
| 深嵌套+500循环 | 6.36ms | 0.00ms | 🚀 11740x |

---

## schemaFragment（Schema 碎片化）

> v0.4.0 新增

### 什么是 schemaFragment

schemaFragment（方案 D）将 Schema 树拆分为独立的响应式碎片，存储在 `SchemaStore` 中。当需要更新 Schema 的某个节点时，只需 patch 对应路径，避免整棵树的重新处理。

### 何时使用

适合以下场景：
- Schema 会动态变化（如可视化编辑器）
- 需要精确控制 Schema 节点的更新
- 大型 Schema 的局部更新

### 如何启用

```typescript
const { vnode, state, renderer } = useVario(schema, {
  rendererOptions: {
    schemaFragment: {
      enabled: true,
      granularity: 'node'
    }
  }
})

// 初始化 Schema Store
renderer.initSchemaStore(schema)

// 精确更新某个节点
renderer.patchSchemaNode('0.1.2', {
  props: { disabled: true }
})
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | false | 是否启用 |
| `granularity` | 'node' \| 'component' | 'node' | 碎片化粒度 |

### API

```typescript
// 获取 Schema Store
const store = renderer.getSchemaStore()

// 初始化（从 Schema 树创建 Store）
renderer.initSchemaStore(schema)

// 精确更新节点
renderer.patchSchemaNode(path, patch)

// 直接操作 Store
store.get(path)           // 获取节点
store.set(path, node)     // 设置节点
store.patch(path, patch)  // 部分更新
store.toTree()            // 还原为完整树
```

### 实际应用示例

#### 示例：可视化表单编辑器

```typescript
const schema = {
  type: 'ElForm',
  children: [
    { type: 'ElInput', model: 'name', props: { placeholder: '姓名' } },
    { type: 'ElInput', model: 'email', props: { placeholder: '邮箱' } }
  ]
}

const { vnode, state, renderer } = useVario(schema, {
  rendererOptions: {
    schemaFragment: { enabled: true }
  }
})

// 初始化
renderer.initSchemaStore(schema)

// 用户在编辑器中修改某个字段的 placeholder
function updateFieldPlaceholder(index: number, placeholder: string) {
  renderer.patchSchemaNode(`0.${index}`, {
    props: { placeholder }
  })
}

// 只更新目标节点，其他节点不受影响
updateFieldPlaceholder(0, '请输入姓名')
```

---

## 组合优化策略

### 不同场景的推荐配置

根据应用类型选择合适的优化组合：

```typescript
// 1. 简单表单页面
useVario(schema, {
  rendererOptions: {
    usePathMemo: true  // 默认配置即可
  }
})

// 2. 长列表应用（Todo、购物车、消息列表）
useVario(schema, {
  rendererOptions: {
    usePathMemo: true,
    loopItemAsComponent: true  // 🚀 核心优化
  }
})

// 3. 复杂后台系统
useVario(schema, {
  rendererOptions: {
    usePathMemo: true,
    loopItemAsComponent: true,
    subtreeComponent: {
      enabled: true,
      granularity: 'boundary'  // 只在组件边界组件化
    }
  }
})

// 4. 可视化编辑器 / 低代码平台
useVario(schema, {
  rendererOptions: {
    usePathMemo: true,
    subtreeComponent: { enabled: true },
    schemaFragment: { enabled: true }  // 支持精确 Schema 更新
  }
})

// 5. 超大规模仪表盘（万级节点）
useVario(schema, {
  rendererOptions: {
    usePathMemo: true,
    loopItemAsComponent: true,
    subtreeComponent: {
      enabled: true,
      granularity: 'all',
      maxDepth: 8  // 限制深度避免过多组件
    }
  }
})
```

### 典型应用场景

```typescript
const schema = {
  type: 'div',
  children: [
    // 静态侧边栏（会被 path-memo 缓存）
    {
      type: 'aside',
      children: [
        { type: 'ElMenu', children: [...] }
      ]
    },
    // 主内容区
    {
      type: 'main',
      children: [
        // 筛选表单（path-memo 缓存）
        {
          type: 'ElForm',
          children: [
            { type: 'ElInput', model: 'search.keyword' },
            { type: 'ElSelect', model: 'search.category' }
          ]
        },
        // 数据表格（loopItemAsComponent 优化）
        {
          type: 'ElTable',
          props: { data: '{{ tableData }}' },
          children: [
            {
              type: 'ElTableColumn',
              loop: {
                items: '{{ tableData }}',
                itemKey: 'row'
              },
              children: [
                // 行内编辑（loopItemAsComponent 确保单行更新）
                { type: 'ElInput', model: 'row.name' },
                { type: 'ElInput', model: 'row.email' }
              ]
            }
          ]
        }
      ]
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: {
    search: { keyword: '', category: '' },
    tableData: [ /* ... */ ]
  },
  rendererOptions: {
    usePathMemo: true,           // 侧边栏、表单等静态结构被缓存
    loopItemAsComponent: true    // 表格行编辑时只更新单行
  }
})
```

---

## 其他优化技巧

### 循环 key 优化

为循环项设置稳定的 `key` 是 Vue 优化的基础：

```typescript
// ✅ 推荐：使用稳定的 id
{
  type: 'div',
  loop: { items: '{{ users }}', itemKey: 'user' },
  props: {
    key: '{{ user.id }}'  // 使用唯一 id
  }
}

// ❌ 不推荐：使用索引或不设置 key
{
  type: 'div',
  loop: { items: '{{ users }}', itemKey: 'user' },
  props: {
    key: '{{ $index }}'  // 索引在增删时会变化
  }
}
```

### 使用 computed 计算属性

对于复杂计算，使用 Vue 的 computed：

```typescript
const { vnode, state } = useVario(schema, {
  state: {
    firstName: 'John',
    lastName: 'Doe'
  },
  computed: {
    // ✅ 使用 computed，有缓存
    fullName: (state) => `${state.firstName} ${state.lastName}`
  }
})

// Schema 中使用
const schema = {
  type: 'div',
  children: '{{ fullName }}'  // 使用 computed 属性
}

// ❌ 避免在 Schema 中重复计算
const badSchema = {
  type: 'div',
  children: '{{ firstName + " " + lastName }}'  // 每次渲染都计算
}
```

### 避免不必要的响应式

使用 `lazy` 选项延迟初始化不常用的字段：

```typescript
const schema = {
  type: 'ElForm',
  children: [
    {
      type: 'ElInput',
      model: 'user.name'
    },
    {
      type: 'ElInput',
      model: 'user.bio',
      lazy: true  // 用户未编辑时不创建响应式
    }
  ]
}

const { vnode, state } = useVario(schema, {
  rendererOptions: {
    modelOptions: {
      lazy: true  // 全局启用 lazy
    }
  }
})
```

---

## 性能调试

### 清除缓存

当 Schema 结构发生重大变化时，可以手动清除缓存：

```typescript
const { vnode, state, renderer } = useVario(schema, {
  rendererOptions: { usePathMemo: true }
})

// 清除所有 path-memo 缓存
renderer.clearPathMemoCache()

// 清除特定组件的缓存
renderer.invalidateComponentCache('ElButton')
```

### 使用 Vue DevTools

1. 安装 [Vue DevTools](https://devtools.vuejs.org/)
2. 打开 Performance 标签
3. 记录渲染性能，查看哪些组件重渲染
4. 检查是否有不必要的更新

---

## 最佳实践总结

### 基本原则

1. **默认启用 path-memo**：几乎所有场景都受益
2. **按需启用 loopItemAsComponent**：长列表单项更新场景启用
3. **大规模 UI 考虑 subtreeComponent**：5000+ 节点或深嵌套时启用
4. **动态 Schema 使用 schemaFragment**：可视化编辑器等场景
5. **确保列表有稳定的 key**：使用 `item.id` 而非索引
6. **合理使用 computed**：复杂计算提取为 computed 属性
7. **控制嵌套深度**：超过 5 层考虑拆分组件

### 优化方案选择指南

| 你的场景 | 推荐配置 |
|----------|----------|
| 静态页面 / 简单表单 | 默认配置 |
| 长列表 + 单项更新 | `loopItemAsComponent: true` |
| 表达式密集 | `usePathMemo: true`（默认） |
| 深嵌套复杂 UI | `subtreeComponent: { enabled: true }` |
| Schema 动态编辑 | `schemaFragment: { enabled: true }` |
| 超大规模应用 | 全部启用 + `maxDepth` 限制 |

### 性能检查清单

- [ ] 所有列表循环都有稳定的 `key`
- [ ] 复杂计算提取为 `computed` 属性
- [ ] 大型列表考虑虚拟滚动
- [ ] 嵌套深度控制在 5 层以内
- [ ] 不常用字段使用 `lazy: true`
- [ ] 长列表场景启用 `loopItemAsComponent`
- [ ] 大规模 UI 考虑 `subtreeComponent`
- [ ] 动态 Schema 场景使用 `schemaFragment`

---

## 进一步学习

- [控制流](/guide/control-flow) - 了解 loop 的更多用法
- [表达式](/guide/expression) - 优化表达式使用
- [API 参考](/api/use-vario) - 查看所有配置选项
