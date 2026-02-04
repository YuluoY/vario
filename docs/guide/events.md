# 事件处理

Vario 提供了灵活的事件处理机制，支持多种语法格式，从简洁的字符串简写到完整的 Action 对象配置。

## 快速开始

最简单的事件处理：

```typescript
const schema: SchemaNode = {
  type: 'button',
  events: {
    click: 'handleClick'  // 字符串简写
  },
  children: '点击我'
}

const { methods } = useVario(schema, {
  methods: {
    handleClick: (ctx) => {
      console.log('Button clicked', ctx.$event)
    }
  }
})
```

## 事件语法格式

Vario 支持多种事件处理语法，可以根据需求选择合适的方式：

### 1. 字符串简写

最简洁的方式，适合简单场景：

```typescript
{
  type: 'button',
  events: {
    click: 'handleClick'  // 单个方法
  }
}
```

**字符串数组**（多个方法依次执行）：

```typescript
{
  type: 'button',
  events: {
    click: ['validate', 'submit']  // 依次调用两个方法
  }
}
```

### 2. Action 对象

完整的 Action 配置，支持参数传递：

```typescript
{
  type: 'button',
  events: {
    click: {
      type: 'call',
      method: 'handleClick',
      params: { id: 123 }
    }
  }
}
```

### 3. Action 数组

支持多个 Action 依次执行：

```typescript
{
  type: 'button',
  events: {
    click: [
      { type: 'set', path: 'loading', value: true },
      { type: 'call', method: 'submit' },
      { type: 'set', path: 'loading', value: false }
    ]
  }
}
```

### 4. 数组简写格式

类似 Vue 的简洁语法 `[type, method, options]`：

```typescript
{
  type: 'button',
  events: {
    click: ['call', 'handleClick', { params: { id: 123 } }]
  }
}
```

## 参数传递

### 静态参数

```typescript
{
  type: 'button',
  events: {
    click: {
      type: 'call',
      method: 'handleClick',
      params: {
        id: 123,
        action: 'submit'
      }
    }
  }
}
```

方法接收参数：

```typescript
methods: {
  handleClick: (ctx, params) => {
    console.log(params)  // { id: 123, action: 'submit' }
  }
}
```

### 表达式参数

使用 `{{ }}` 语法传递动态值：

```typescript
{
  type: 'button',
  events: {
    click: {
      type: 'call',
      method: 'deleteItem',
      params: {
        id: '{{ item.id }}',
        name: '{{ item.name }}'
      }
    }
  }
}
```

### 数组简写中传递参数

```typescript
{
  type: 'button',
  events: {
    click: ['call', 'handleClick', { 
      params: { userId: '{{ user.id }}' } 
    }]
  }
}
```

## 事件修饰符

### 事件名修饰符（推荐）

直接在事件名中使用修饰符，类似 Vue：

```typescript
{
  type: 'button',
  events: {
    'click.stop.prevent': 'handleClick'
  }
}
```

支持的修饰符：
- `.stop` - 阻止事件冒泡
- `.prevent` - 阻止默认行为
- `.self` - 只在事件源是自身时触发
- `.once` - 只触发一次
- `.capture` - 捕获模式
- `.passive` - 被动监听

详见 [事件修饰符文档](./event-modifiers.md) 了解更多修饰符用法。

## 完整示例

结合多种语法的综合示例：

```typescript
const schema: SchemaNode = {
  type: 'div',
  children: [
    {
      type: 'button',
      events: {
        // 字符串简写
        click: 'simpleClick'
      },
      children: '简单点击'
    },
    {
      type: 'button',
      events: {
        // 带修饰符的字符串简写
        'click.stop.prevent': 'preventClick'
      },
      children: '阻止默认'
    },
    {
      type: 'button',
      events: {
        // 完整 Action 对象，带参数
        click: {
          type: 'call',
          method: 'deleteItem',
          params: { id: '{{ item.id }}' }
        }
      },
      children: '删除'
    },
    {
      type: 'button',
      events: {
        // 数组简写格式
        'click.once': ['call', 'handleOnce', { params: { msg: 'Only once' } }]
      },
      children: '只能点一次'
    },
    {
      type: 'button',
      events: {
        // 多个 Action
        click: [
          { type: 'set', path: 'loading', value: true },
          { type: 'call', method: 'submit' },
          { type: 'set', path: 'loading', value: false }
        ]
      },
      children: '提交'
    }
  ]
}

const { methods } = useVario(schema, {
  state: { loading: false, item: { id: 123 } },
  methods: {
    simpleClick: (ctx) => console.log('Simple'),
    preventClick: (ctx) => console.log('Prevented'),
    deleteItem: (ctx, params) => console.log('Delete', params.id),
    handleOnce: (ctx, params) => console.log(params.msg),
    submit: (ctx) => console.log('Submitting...')
  }
})
```

## 方法上下文

事件处理方法接收的参数：

```typescript
methods: {
  handleClick: (ctx, params) => {
    // ctx: RuntimeContext，包含：
    // - $event: 原生事件对象
    // - $methods: 所有方法
    // - 状态数据
    
    // params: Action 中配置的 params
    console.log(ctx.$event)  // Event 对象
    console.log(params)      // { id: 123 }
  }
}
```

## 最佳实践

1. **简单场景用字符串简写**：
   ```typescript
   events: { click: 'handleClick' }
   ```

2. **需要参数时用完整 Action**：
   ```typescript
   events: { 
     click: { type: 'call', method: 'delete', params: { id: '{{ item.id }}' } }
   }
   ```

3. **修饰符用事件名语法**：
   ```typescript
   events: { 'click.stop.prevent': 'handleClick' }
   ```

4. **多步骤用 Action 数组**：
   ```typescript
   events: {
     click: [
       { type: 'set', path: 'loading', value: true },
       { type: 'call', method: 'submit' }
     ]
   }
   ```

## 参考

- [事件修饰符](./event-modifiers.md)
- [表达式语法](./expression.md)
- [Action 类型](../api/types.md)
