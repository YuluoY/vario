# 节点上下文 (Node Context)

在事件处理器（methods）中，Vario 提供了强大的节点上下文功能，允许你访问当前节点、父节点、兄弟节点和子节点，实现灵活的节点间交互。

## 概述

通过运行时上下文 `ctx`，你可以访问以下节点关系：

- **`ctx.$self`** - 当前节点
- **`ctx.$parent`** - 父节点（支持链式访问祖先）
- **`ctx.$siblings`** - 兄弟节点数组（不包含自身）
- **`ctx.$children`** - 子节点数组

## 基础用法

### 访问当前节点

```typescript
methods: {
  handleClick: ({ ctx }) => {
    // 访问当前节点的属性
    console.log('当前节点类型:', ctx.$self.type)
    console.log('当前节点 props:', ctx.$self.props)
    
    // 访问当前节点的 model
    if (ctx.$self.model) {
      console.log('当前节点绑定的 model:', ctx.$self.model)
    }
  }
}
```

### 访问父节点

```typescript
methods: {
  handleClick: ({ ctx }) => {
    // 访问父节点
    if (ctx.$parent) {
      console.log('父节点类型:', ctx.$parent.type)
      console.log('父节点 props:', ctx.$parent.props)
    }
  }
}
```

### 链式访问祖先节点

使用 Proxy 实现的链式访问，可以轻松获取任意层级的祖先节点：

```typescript
methods: {
  handleClick: ({ ctx }) => {
    // 访问祖父节点
    const grandparent = ctx.$parent?.$parent
    if (grandparent) {
      console.log('祖父节点类型:', grandparent.type)
    }
    
    // 访问曾祖父节点
    const greatGrandparent = ctx.$parent?.$parent?.$parent
    
    // 一直向上追溯到根节点
    let ancestor = ctx.$parent
    while (ancestor?.$parent) {
      ancestor = ancestor.$parent
    }
    console.log('根节点:', ancestor)
  }
}
```

### 访问兄弟节点

```typescript
methods: {
  handleClick: ({ ctx }) => {
    // 访问所有兄弟节点（不包含自身）
    console.log('兄弟节点数量:', ctx.$siblings?.length)
    
    // 遍历兄弟节点
    ctx.$siblings?.forEach((sibling, index) => {
      console.log(`兄弟 ${index}:`, sibling.type)
    })
    
    // 访问第一个兄弟节点
    const firstSibling = ctx.$siblings?.[0]
    if (firstSibling) {
      console.log('第一个兄弟:', firstSibling.type)
    }
  }
}
```

### 访问子节点

```typescript
methods: {
  handleClick: ({ ctx }) => {
    // 访问所有子节点
    console.log('子节点数量:', ctx.$children?.length)
    
    // 遍历子节点
    ctx.$children?.forEach((child, index) => {
      console.log(`子节点 ${index}:`, child.type)
    })
  }
}
```

## 实战示例

### 示例 1：表单字段间联动

```typescript
const schema = {
  type: 'div',
  children: [
    {
      type: 'ElInput',
      model: 'password',
      props: { type: 'password', placeholder: '密码' },
      events: {
        input: 'validatePassword'
      }
    },
    {
      type: 'ElInput',
      model: 'confirmPassword',
      props: { type: 'password', placeholder: '确认密码' },
      events: {
        input: 'validateConfirmPassword'
      }
    },
    {
      type: 'div',
      props: { class: 'error-message' },
      show: '{{ passwordError }}',
      children: '{{ passwordError }}'
    }
  ]
}

const methods = {
  validatePassword: ({ state, ctx }) => {
    const password = state.password
    // 如果确认密码已填写，检查父节点下的其他输入框
    if (state.confirmPassword) {
      // 访问父节点下的所有子节点，找到确认密码输入框
      const siblings = ctx.$parent?.$children
      console.log('同层字段:', siblings?.map(s => s.model))
    }
  },
  
  validateConfirmPassword: ({ state, ctx }) => {
    // 通过兄弟节点访问密码字段
    const passwordField = ctx.$siblings?.find(s => s.model === 'password')
    if (passwordField) {
      if (state.password !== state.confirmPassword) {
        state.passwordError = '两次密码不一致'
      } else {
        state.passwordError = ''
      }
    }
  }
}
```

### 示例 2：动态表单行操作

```typescript
const schema = {
  type: 'div',
  loop: {
    items: '{{ formRows }}',
    itemKey: 'item',
    indexKey: 'index'
  },
  children: [
    {
      type: 'div',
      props: { class: 'form-row' },
      children: [
        {
          type: 'ElInput',
          model: 'item.name',
          props: { placeholder: '名称' }
        },
        {
          type: 'ElButton',
          props: { size: 'small' },
          events: {
            click: 'moveUp'
          },
          children: '上移'
        },
        {
          type: 'ElButton',
          props: { size: 'small' },
          events: {
            click: 'moveDown'
          },
          children: '下移'
        },
        {
          type: 'ElButton',
          props: { type: 'danger', size: 'small' },
          events: {
            click: 'deleteRow'
          },
          children: '删除'
        }
      ]
    }
  ]
}

const methods = {
  moveUp: ({ ctx, state }) => {
    // 访问当前行所在的兄弟节点
    const currentRow = ctx.$parent // 当前按钮的父节点（form-row）
    const allRows = ctx.$parent?.$parent?.$children // 所有行
    
    // 通过节点找到对应的数据索引
    const currentIndex = allRows?.indexOf(currentRow) ?? -1
    if (currentIndex > 0) {
      const temp = state.formRows[currentIndex]
      state.formRows[currentIndex] = state.formRows[currentIndex - 1]
      state.formRows[currentIndex - 1] = temp
    }
  },
  
  moveDown: ({ ctx, state }) => {
    const currentRow = ctx.$parent
    const allRows = ctx.$parent?.$parent?.$children
    const currentIndex = allRows?.indexOf(currentRow) ?? -1
    
    if (currentIndex < (state.formRows?.length ?? 0) - 1) {
      const temp = state.formRows[currentIndex]
      state.formRows[currentIndex] = state.formRows[currentIndex + 1]
      state.formRows[currentIndex + 1] = temp
    }
  },
  
  deleteRow: ({ ctx, state }) => {
    const currentRow = ctx.$parent
    const allRows = ctx.$parent?.$parent?.$children
    const currentIndex = allRows?.indexOf(currentRow) ?? -1
    
    if (currentIndex >= 0) {
      state.formRows.splice(currentIndex, 1)
    }
  }
}
```

### 示例 3：级联选择器

```typescript
const schema = {
  type: 'div',
  children: [
    {
      type: 'ElSelect',
      model: 'province',
      props: { placeholder: '选择省份' },
      events: {
        change: 'onProvinceChange'
      },
      children: '...' // 省份选项
    },
    {
      type: 'ElSelect',
      model: 'city',
      props: { 
        placeholder: '选择城市',
        disabled: '{{ !province }}'
      },
      events: {
        change: 'onCityChange'
      },
      children: '...' // 城市选项
    },
    {
      type: 'ElSelect',
      model: 'district',
      props: { 
        placeholder: '选择区县',
        disabled: '{{ !city }}'
      },
      children: '...' // 区县选项
    }
  ]
}

const methods = {
  onProvinceChange: ({ state, ctx }) => {
    // 清空后续级联选择
    state.city = ''
    state.district = ''
    
    // 通过兄弟节点访问城市和区县选择器
    const citySelect = ctx.$siblings?.find(s => s.model === 'city')
    const districtSelect = ctx.$siblings?.find(s => s.model === 'district')
    
    // 可以根据省份加载城市数据
    console.log('省份改变，重置后续选择')
  },
  
  onCityChange: ({ state, ctx }) => {
    state.district = ''
    
    // 访问父节点查看完整的级联路径
    const container = ctx.$parent
    console.log('当前级联容器:', container?.type)
  }
}
```

### 示例 4：树形结构导航

```typescript
methods: {
  navigateToParent: ({ ctx }) => {
    // 导航到父节点
    if (ctx.$parent) {
      console.log('导航到父节点:', ctx.$parent.type)
      // 可以触发父节点的某些状态变化
    }
  },
  
  navigateToBreadcrumb: ({ ctx }) => {
    // 生成面包屑导航
    const breadcrumb: string[] = []
    let current = ctx.$self
    
    while (current) {
      if (current.props?.label) {
        breadcrumb.unshift(current.props.label as string)
      }
      current = current.$parent
    }
    
    console.log('面包屑:', breadcrumb.join(' / '))
    return breadcrumb
  },
  
  findAncestorByType: ({ ctx }, targetType: string) => {
    // 向上查找特定类型的祖先节点
    let ancestor = ctx.$parent
    while (ancestor) {
      if (ancestor.type === targetType) {
        return ancestor
      }
      ancestor = ancestor.$parent
    }
    return null
  }
}
```

## 注意事项

### 1. 节点代理和安全性

- 节点通过 **Proxy** 包装，访问 `$parent` 会动态解析
- 只能**读取**节点属性，不能直接**修改** `$parent` 等关系
- 修改节点属性会作用于真实的 Schema 对象

```typescript
// ✅ 正确：读取节点属性
const parentType = ctx.$parent?.type

// ✅ 正确：读取并修改节点属性
if (ctx.$self.props) {
  ctx.$self.props.disabled = true
}

// ❌ 错误：不能重新赋值节点关系
ctx.$parent = someOtherNode // 无效操作
```

### 2. 性能考虑

- 节点关系通过 **WeakMap** 维护，性能开销很小
- 链式访问（如 `$parent.$parent.$parent`）会创建多个 Proxy，但仍然高效
- 建议缓存频繁访问的节点引用

```typescript
// ✅ 推荐：缓存节点引用
methods: {
  handleClick: ({ ctx }) => {
    const parent = ctx.$parent
    if (parent) {
      console.log(parent.type)
      console.log(parent.props)
      // 多次使用 parent，避免重复访问
    }
  }
}
```

### 3. 循环渲染中的节点关系

在 `loop` 渲染的节点中，`$siblings` 指的是同一次循环迭代生成的兄弟节点，不是数组中的其他项：

```typescript
const schema = {
  type: 'div',
  loop: {
    items: '{{ list }}',
    itemKey: 'item'
  },
  children: [
    {
      type: 'span',
      children: '{{ item.name }}'
    },
    {
      type: 'button',
      events: {
        click: ({ ctx }) => {
          // $siblings 是同一个 item 渲染的其他节点（这里是上面的 span）
          console.log('同层兄弟:', ctx.$siblings?.map(s => s.type))
          
          // $parent 是 loop 的容器节点（div）
          console.log('父节点:', ctx.$parent?.type)
        }
      }
    }
  ]
}
```

### 4. 类型提示

在 TypeScript 中，节点上下文的类型定义如下：

```typescript
import type { RuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'

interface ExtendedContext extends RuntimeContext {
  $self: SchemaNode
  $parent: SchemaNode | null
  $siblings: SchemaNode[]
  $children: SchemaNode[] | undefined
}

// 在 methods 中使用
methods: {
  handleClick: ({ ctx }: { ctx: ExtendedContext }) => {
    ctx.$self // 有完整的 SchemaNode 类型提示
    ctx.$parent?.type // 可选链访问
  }
}
```

## 与 Schema 查询的对比

节点上下文与 [Schema 查询](/guide/schema-query) 功能互补：

| 功能 | 节点上下文 | Schema 查询 |
|------|-----------|------------|
| **访问方式** | 运行时，基于当前节点 | 静态查询，基于整个 Schema |
| **使用场景** | 事件处理中动态访问相关节点 | 初始化时查找特定节点 |
| **性能** | O(1) 直接访问 | O(n) 需要遍历 |
| **灵活性** | 只能访问相邻节点 | 可以查询任意节点 |

**推荐实践：**
- 在**事件处理**中使用节点上下文（快速访问相关节点）
- 在**初始化/配置**时使用 Schema 查询（查找特定节点并配置）

```typescript
// ✅ 事件处理中使用节点上下文
methods: {
  handleClick: ({ ctx }) => {
    const parent = ctx.$parent
    // 快速访问父节点
  }
}

// ✅ 初始化时使用 Schema 查询
const { query } = useSchemaQuery(schema)
const submitButton = query('[type="ElButton"][props.type="primary"]')
// 查找特定按钮
```

## 相关功能

- [Schema 查询](/guide/schema-query) - 使用选择器查询 Schema 节点
- [事件处理](/guide/events) - 在事件中使用节点上下文
- [Methods](/guide/methods) - 定义事件处理方法

## 总结

节点上下文功能为 Vario 提供了强大的节点间交互能力：

- ✅ 通过 `ctx.$self`、`ctx.$parent`、`ctx.$siblings`、`ctx.$children` 访问节点关系
- ✅ 支持链式访问祖先节点（`$parent.$parent.$parent`）
- ✅ 使用 Proxy 实现，性能优秀
- ✅ 不污染原始 Schema 对象
- ✅ 在表单联动、级联选择、动态列表等场景特别有用
