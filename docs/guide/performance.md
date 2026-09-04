# 性能优化

本章介绍 @variojs/vue 提供的渲染优化特性，帮助你在大规模应用中获得更好的性能。

## 概述

vario-vue 采用 **Scope-Weight Hybrid** 自适应优化策略，所有性能优化均为**零配置自动生效**：

- **path-memo**：路径缓存（始终开启）
- **Scope-Weight 子树组件化**：在 scope boundary 上按权重自动决策
- **Scope-Weight 循环组件化**：按模板权重自动决策

```typescript
// 无需任何配置，优化自动生效
const { vnode, state } = useVario(schema)
```

### 优化方案对比

| 优化方案 | 工作方式 | 配置 |
|----------|----------|------|
| **path-memo** | 按路径缓存 VNode，未变分支复用 | 始终开启，零配置 |
| **Scope-Weight 子树组件化** | scope boundary + weight > 5 时自动组件化 | 自适应，零配置 |
| **Scope-Weight 循环组件化** | 模板 weight > 5 时列表项自动组件化 | 自适应，零配置 |

---

## path-memo（路径缓存）

### 什么是 path-memo

path-memo 是一种渲染缓存优化，通过缓存每个节点路径对应的 VNode，当状态更新时，只重新渲染发生变化的分支，其他分支直接复用缓存。

### 适用场景

- Schema 中有大量静态节点（不依赖状态）
- 使用了复杂的表达式计算
- 表单、表格等结构固定的页面
- 状态更新频繁但影响范围小

path-memo **始终开启**，无需任何配置。

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

## Scope-Weight 子树组件化

### 什么是子树组件化

当 Schema 树中的节点满足以下条件时，渲染器自动将其包装为独立的 Vue 组件 `VarioNode`：

1. **是 scope boundary**：有 model 绑定、自定义组件（首字母大写）、生命周期钩子、provide/inject
2. **子树权重 > COMPONENT_OVERHEAD (5)**：子树足够"重"，组件化收益大于开销

当节点的 props 未变化时，Vue 会自动跳过该子树的 re-render，实现更精细的渲染控制。

### 适用场景

- 超大规模 UI（5000+ 节点）
- 深度嵌套结构（10+ 层）
- 包含大量自定义组件的复杂页面

### 实际应用示例

```typescript
const schema = {
  type: 'div',
  props: { class: 'dashboard' },
  children: [
    // AppHeader 是自定义组件（scope boundary），权重 > 5 → 自动组件化
    { type: 'AppHeader', children: [...] },
    
    // 侧边栏
    { type: 'AppSidebar', children: [...] },
    
    // 主内容区
    {
      type: 'main',
      children: [
        { type: 'StatsWidget', props: { data: '{{ stats }}' } },
        { type: 'ChartWidget', props: { data: '{{ chartData }}' } },
      ]
    }
  ]
}

const { vnode, state } = useVario(schema)

// 更新 stats 时，只有 StatsWidget 重新渲染
state.stats = { ... }
```

### 显式强制组件化 _componentize

自动组件化需要同时满足「scope boundary」和「子树权重 > 5」两个条件。当你确定某个子树需要渲染隔离、但不满足自动条件时（例如子树只有 3 个节点但含高频更新的表达式），可以在节点上显式声明：

```typescript
const schema = {
  type: 'div',
  children: [
    {
      type: 'ElDialog',
      _componentize: true,   // 🎯 显式 opt-in，绕过 scope boundary 与阈值检查
      children: [
        { type: 'ElInput', model: 'form.title' },
        { type: 'ElInput', model: 'form.desc' }
      ]
    }
  ]
}
```

判定优先级（`shouldComponentize`）：

1. **loop 节点永不组件化**（循环由 LoopHandler / LoopItemCell 接管）
2. `_componentize: true` → 直接组件化
3. 是 scope boundary 且后代节点数 ≥ 5 → 自动组件化
4. 其余 → 内联渲染

注意：`_componentize` 是渲染提示属性，未纳入正式类型声明（通过 `SchemaNode` 的扩展属性通道传入），组件数量过多会带来额外实例开销，仅在自动规则不达标且有实测收益时使用。

---

## Scope-Weight 循环组件化

### 什么是循环组件化

当循环模板的权重 > COMPONENT_OVERHEAD (5) 时，渲染器自动将每一项包装为 `LoopItemCell` 组件。当列表中某一项数据变化时，Vue 只重新渲染该项，其他项完全跳过。

### 适用场景

- 长列表（100+ 项）且频繁更新单项
- Todo List、购物车等单项操作场景
- 表格行内编辑
- 列表项包含复杂组件（如 Element Plus 组件）

### 实际应用示例

```typescript
const schema = {
  type: 'div',
  children: [{
    type: 'div',
    loop: {
      items: '{{ todos }}',
      itemKey: 'item'
    },
    props: { key: '{{ item.id }}' },
    children: [
      {
        type: 'ElCheckbox',
        model: 'item.done',
        children: '{{ item.text }}'
      },
      {
        type: 'ElButton',
        events: {
          click: {
            type: 'call',
            method: 'deleteTodo',
            params: ['{{ item.id }}']
          }
        },
        children: '删除'
      }
    ]
  }]
}

const { vnode, state } = useVario(schema, {
  state: {
    todos: [
      { id: 1, text: 'Learn Vario', done: false },
      { id: 2, text: 'Build App', done: false }
    ]
  },
  methods: {
    deleteTodo: ({ state, params }) => {
      state.todos = state.todos.filter(t => t.id !== params[0])
    }
  }
})

// 模板权重 > 5（含 ElCheckbox + ElButton），自动组件化
// 切换某个 todo 的 done 状态时，只重渲染该项
state.todos[0].done = true
```

---

## 长列表虚拟化

### 什么是虚拟化

当列表项数达到数千级时，全量展开 DOM 会突破渲染预算。虚拟化只渲染**可视范围内**的循环项，其余项由宿主适配器（滚动容器）管理。Vario 通过 `loop.virtual` 声明意图，通过 `virtualAdapter` 提供实现：

```typescript
import { useVario, createReferenceVirtualAdapter } from '@variojs/vue'

const schema = {
  type: 'div',
  children: [{
    type: 'ElTableRow',
    loop: {
      items: '{{ rows }}',
      itemKey: 'row',
      key: 'uid',         // 稳定 key（item 属性名），滚动时复用已有单元格
      virtual: true       // 声明该循环接受虚拟化
    },
    children: '{{ row.label }}'
  }]
}

const { vnode } = useVario(schema, {
  state: { rows: [] },
  // 虚拟化适配器：默认实现按 viewport=200、overscan=4 截取
  virtualAdapter: createReferenceVirtualAdapter({ viewport: 200, overscan: 4 })
})
```

### 行为规则

- `virtual: true`（或缺省）：提供了 `virtualAdapter` 时按可视范围渲染
- `virtual: false`：强制全量展开，适合小列表，但仍受预算约束
- 未提供适配器时，无论 `virtual` 取值均全量渲染

### 预算与诊断

| 机制 | 触发条件 | 行为 |
|------|----------|------|
| `LOOP_LARGE_LIST` 诊断 | 项数 > `maxLoopItemsPerRegion`（默认 1000） | 不截断全量渲染，提示接入虚拟化 |
| `LOOP_BUDGET_EXCEEDED` | 展开节点数超出 `maxExpandedNodes`（默认 10000）等预算 | 抛错终止渲染 |
| `LOOP_DUPLICATE_KEY` | `key` 解析出重复值 | 抛错并发出诊断 |

预算可通过 `useVario` 的 `runtimeBudget` 调整（`maxExpandedNodes`、`maxLoopItemsPerRegion`、`maxActiveLoopCells` 等）。

### 自定义适配器

参考实现只做简单的条数截取。接入真实滚动容器（如 Element Plus 虚拟化表格）时实现 `VirtualListAdapter` 接口：

```typescript
import type { VirtualListAdapter } from '@variojs/vue'

const myAdapter: VirtualListAdapter = {
  // 返回当前应渲染的 [start, end) 区间与两侧预取量
  getVisibleRange(input) {
    const { scrollTop, rowHeight, viewportHeight } = measureContainer()
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4)
    const end = Math.min(input.itemCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 4)
    return { start, end, overscan: 4 }
  },
  // 列表项数变化时同步滚动状态（可选）
  onItemsChanged(change) { syncScrollbar(change.itemCount) },
  // 滚动位置恢复锚点（可选）
  restoreAnchor(key) { scrollToKey(key) }
}
```

> 虚拟化依赖 prepared 渲染管线（`runtimeMode: 'shadow' | 'prepared'`），legacy 管线下 `virtual` 与 `virtualAdapter` 不生效。

---

## 其他优化技巧

### 循环 key 优化

为循环项设置稳定的 `key` 是 Vue 优化的基础。v0.4+ 推荐在 `loop` 上声明 `key`（prepared 管线生效，缺省回退 `item.id` → `itemKey:index`，见[控制流指南](/guide/control-flow#key-稳定-item-key)）：

```typescript
// ✅ v0.4+ 推荐：loop.key 声明式稳定 key
{
  type: 'div',
  loop: { items: '{{ users }}', itemKey: 'user', key: 'uid' },
  children: '{{ user.name }}'
}

// ✅ legacy 管线：props.key 表达式
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
```

### 避免不必要的响应式

使用 `lazy` 选项延迟初始化不常用的字段：

```typescript
const schema = {
  type: 'ElForm',
  children: [
    { type: 'ElInput', model: 'user.name' },
    {
      type: 'ElInput',
      model: 'user.bio',
      lazy: true  // 用户未编辑时不创建响应式
    }
  ]
}

const { vnode, state } = useVario(schema, {
  modelOptions: { lazy: true }  // 全局启用 lazy
})
```

---

## 性能调试

### 使用 Vue DevTools

1. 安装 [Vue DevTools](https://devtools.vuejs.org/)
2. 打开 Performance 标签
3. 记录渲染性能，查看哪些组件重渲染
4. 检查是否有不必要的更新

---

## 最佳实践总结

### 基本原则

1. **零配置优化**：所有优化自动生效，无需手动配置
2. **确保列表有稳定的 key**：使用 `item.id` 而非索引
3. **合理使用 computed**：复杂计算提取为 computed 属性
4. **控制嵌套深度**：超过 5 层考虑拆分组件
5. **不常用字段使用 lazy**：减少不必要的响应式开销

### 性能检查清单

- [ ] 所有列表循环都有稳定的 `key`
- [ ] 复杂计算提取为 `computed` 属性
- [ ] 大型列表考虑虚拟滚动
- [ ] 嵌套深度控制在 5 层以内
- [ ] 不常用字段使用 `lazy: true`

---

## 进一步学习

- [控制流](/guide/control-flow) - 了解 loop 的更多用法
- [表达式](/guide/expression) - 优化表达式使用
- [API 参考](/api/use-vario) - 查看所有配置选项
