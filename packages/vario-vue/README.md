# 🎨 @variojs/vue

Vario Vue 渲染器 - 深度集成 Vue 3 的 Schema 渲染器

## 特点

- 🚀 **深度集成**：完整支持 Vue 3 Composition API
- 📦 **声明式 Schema**：JSON Schema 定义 UI，简洁易维护
- 🔄 **自动响应式**：状态自动包裹为响应式，支持层级依赖收集
- 🎯 **Vue 特性支持**：ref、生命周期、provide/inject、teleport 等

## 安装

```bash
npm install @variojs/vue
# 或
pnpm add @variojs/vue
```

依赖的 `@variojs/core`、`@variojs/schema` 和 `vue` 会自动安装。

## 快速开始

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
      children: '{{ name }}'
    },
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

export default {
  setup() {
    const { vnode, state, methods } = useVario(schema, {
      state: {
        name: ''
      },
      methods: {
        handleClick: ({ state, ctx }) => {
          console.log('Clicked', state.name)
        }
      }
    })
    
    return { vnode, state }
  }
}
```

## 核心特性

### 双向绑定

```typescript
{
  type: 'ElInput',
  model: 'user.name'  // 自动创建响应式绑定
}
```

### 表达式

```typescript
{
  type: 'div',
  children: '{{ firstName + " " + lastName }}',
  show: 'count > 10'
}
```

### 循环渲染

```typescript
{
  type: 'div',
  loop: {
    items: '{{ userList }}',
    itemKey: 'item'
  },
  children: '{{ item.name }}'
}
```

### Vue 特性

- **Ref 模板引用**：`ref: 'inputRef'`
- **生命周期**：`onMounted: 'initData'`
- **Provide/Inject**：`provide: { theme: 'dark' }`
- **Teleport**：`teleport: 'body'`

## 性能优化

采用 **Scope-Weight Hybrid** 自适应优化策略，所有优化**零配置自动生效**：

| 优化方案 | 工作方式 | 配置 |
|----------|----------|------|
| **path-memo** | 按路径缓存 VNode，未变分支复用 | 始终开启 |
| **子树组件化** | scope boundary + weight > 5 时自动拆分 | 自适应 |
| **循环组件化** | 模板 weight > 5 时列表项自动包装 | 自适应 |

```typescript
// 无需任何配置，优化自动生效
const { vnode, state } = useVario(schema)
```

详见 [性能优化文档](./docs/benchmark.md)

## 优势

- ✅ **类型推导**：完整的 TypeScript 类型支持
- ✅ **高性能**：path-memo、列表项组件化，最高 88 倍加速
- ✅ **自动同步**：状态与运行时上下文双向同步
- ✅ **Vue 原生**：computed、watch 使用 Vue 原生 API
- ✅ **节点上下文**：支持 `$parent`、`$root` 访问

## 许可证

MIT
