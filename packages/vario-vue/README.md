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

## 性能优化（v0.3.0）

内置多项优化方案，经基准测试验证：

| 优化方案 | 适用场景 | 加速倍数 |
|----------|----------|----------|
| **path-memo** | 表达式密集、静态子树 | 2-88x 🔥 |
| **loopItemAsComponent** | 长列表单项更新 | 4-29x 🔥 |
| **subtreeComponent** | 大规模/深嵌套 UI | 2-12x |
| **schemaFragment** | 精确 Schema 更新 | 按需 |

### 启用优化

```typescript
const { vnode, state } = useVario(schema, {
  rendererOptions: {
    usePathMemo: true,           // 默认已启用
    loopItemAsComponent: true,   // 推荐生产环境启用
    
    // 方案 C：子树组件化（v0.4.0）
    subtreeComponent: {
      enabled: true,             // 启用子树组件化
      granularity: 'boundary',   // 'all' | 'boundary'
      maxDepth: 10               // 最大组件化深度
    },
    
    // 方案 D：Schema 碎片化（v0.4.0）
    schemaFragment: {
      enabled: true,             // 启用 Schema 碎片化
      granularity: 'node'        // 'node' | 'component'
    }
  }
})
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
