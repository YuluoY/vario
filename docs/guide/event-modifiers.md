# 事件修饰符

事件修饰符是 Vario 提供的强大功能，用于在事件处理时添加常见的行为控制，类似于 Vue 的事件修饰符。

## 概述

Vario 支持两种方式使用事件修饰符：

1. **事件名修饰符**（推荐）：直接在事件名中使用 `.` 分隔，如 `"click.stop.prevent"`
2. **数组简写修饰符**：在数组简写的第四个位置指定，如 `['call', 'method', [], ['stop']]`

两种方式可以组合使用，修饰符会自动合并。

### 支持的修饰符

| 修饰符 | 说明 | 对应 DOM API |
|--------|------|-------------|
| `.stop` | 阻止事件冒泡 | `event.stopPropagation()` |
| `.prevent` | 阻止默认行为 | `event.preventDefault()` |
| `.self` | 只在事件源是元素自身时触发 | `event.target === event.currentTarget` |
| `.once` | 事件处理器只触发一次 | - |
| `.capture` | 使用事件捕获模式 | `{ capture: true }` |
| `.passive` | 被动事件监听器 | `{ passive: true }` |

## 基本用法

### 方式 1：事件名修饰符（推荐）

直接在事件名中使用点语法，类似 Vue：

```typescript
const schema: SchemaNode = {
  type: 'button',
  events: {
    'click.stop.prevent': [{ type: 'call', method: 'handleClick' }]
  }
}

// 字符串简写也支持
const schema2: SchemaNode = {
  type: 'button',
  events: {
    'click.stop': 'handleClick'
  }
}
```

### 方式 2：数组简写修饰符

在数组简写格式 `[call, method, params?, modifiers?]` 的第四个位置指定修饰符：

```typescript
// 数组形式的修饰符
const schema: SchemaNode = {
  type: 'button',
  events: {
    click: ['call', 'handleClick', [], ['stop', 'prevent']]
  }
}

// 对象形式的修饰符
const schema2: SchemaNode = {
  type: 'button',
  events: {
    click: ['call', 'handleClick', [], { stop: true, prevent: true }]
  }
}
```

### 两种方式混合使用

事件名修饰符和数组简写修饰符可以组合使用，修饰符会自动合并：

```typescript
const schema: SchemaNode = {
  type: 'button',
  events: {
    // 事件名带 stop，数组简写带 prevent，两个都会生效
    'click.stop': ['call', 'handleClick', [], ['prevent']]
  }
}
```

## 修饰符详解

### .stop - 阻止冒泡

阻止事件向父元素冒泡：

```typescript
{
  type: 'div',
  events: {
    click: 'onOuterClick'
  },
  children: [
    {
      type: 'button',
      events: {
        'click.stop': 'onInnerClick'  // 不会触发 onOuterClick
      },
      children: '点击我'
    }
  ]
}
```

### .prevent - 阻止默认行为

阻止浏览器的默认行为：

```typescript
// 阻止表单默认提交
{
  type: 'form',
  events: {
    'submit.prevent': 'handleSubmit'
  },
  children: [...]
}

// 阻止链接跳转
{
  type: 'a',
  props: { href: '#' },
  events: {
    'click.prevent': 'handleClick'
  },
  children: '点击不跳转'
}
```

### .self - 仅自身触发

只有当事件在元素本身（而非子元素）触发时才执行：

```typescript
{
  type: 'div',
  props: { class: 'modal-overlay' },
  events: {
    'click.self': 'closeModal'  // 点击子元素不会关闭
  },
  children: [
    {
      type: 'div',
      props: { class: 'modal-content' },
      children: '弹窗内容'
    }
  ]
}
```

### .once - 只触发一次

事件处理器只执行一次，之后自动移除：

```typescript
{
  type: 'button',
  events: {
    'click.once': 'handleFirstClick'
  },
  children: '只能点一次'
}
```

### .capture - 捕获模式

使用事件捕获而不是冒泡：

```typescript
{
  type: 'div',
  events: {
    'click.capture': 'handleCapture'  // 在捕获阶段触发
  },
  children: [...]
}
```

### .passive - 被动监听

告诉浏览器处理器不会调用 preventDefault()，可优化滚动性能：

```typescript
{
  type: 'div',
  events: {
    'scroll.passive': 'handleScroll'  // 优化滚动性能
  },
  children: [...]
}

// 同时使用 capture 和 passive
{
  type: 'div',
  events: {
    'touchstart.capture.passive': 'handleTouch'
  },
  children: [...]
}
```

## 组合修饰符

可以链式使用多个修饰符：

```typescript
// 同时阻止冒泡和默认行为
{
  type: 'a',
  props: { href: '/path' },
  events: {
    'click.stop.prevent': 'handleClick'
  },
  children: '链接'
}

// 捕获模式 + 被动 + 只触发一次
{
  type: 'div',
  events: {
    'scroll.capture.passive.once': 'handleFirstScroll'
  },
  children: [...]
}
```

## 与 Vue 对比

| 特性 | Vue 写法 | Vario 写法 |
|------|----------|------------|
| 阻止冒泡 | `@click.stop` | `'click.stop': handler` |
| 阻止默认 | `@click.prevent` | `'click.prevent': handler` |
| 组合修饰符 | `@click.stop.prevent` | `'click.stop.prevent': handler` |
| 数组简写 | - | `click: ['call', 'fn', [], ['stop']]` |

## 实际案例

### 模态框

```typescript
const modalSchema: SchemaNode = {
  type: 'div',
  props: { class: 'modal-mask' },
  events: {
    'click.self': 'closeModal'  // 点击遮罩关闭
  },
  children: [
    {
      type: 'div',
      props: { class: 'modal-content' },
      events: {
        'click.stop': []  // 阻止冒泡到遮罩层（空数组表示不执行任何 action）
      },
      children: '弹窗内容，点击不会关闭'
    }
  ]
}
```

### 表单提交

```typescript
const formSchema: SchemaNode = {
  type: 'form',
  events: {
    'submit.prevent': ['call', 'handleSubmit', [], ['stop']]
  },
  children: [
    {
      type: 'input',
      model: 'username'
    },
    {
      type: 'button',
      props: { type: 'submit' },
      children: '提交'
    }
  ]
}
```

### 滚动优化

```typescript
const scrollableSchema: SchemaNode = {
  type: 'div',
  props: { 
    class: 'scrollable',
    style: { height: '300px', overflow: 'auto' }
  },
  events: {
    'scroll.passive': 'handleScroll'
  },
  children: [...]
}
```

### 键盘快捷键

```typescript
const inputSchema: SchemaNode = {
  type: 'input',
  model: 'search',
  events: {
    'keydown.prevent': ['call', 'handleKeydown', ['{{$event.key}}']]
  }
}
```

## 类型定义

```typescript
// 支持的修饰符
type EventModifier = 'stop' | 'prevent' | 'self' | 'once' | 'capture' | 'passive'

// 事件名带修饰符
type EventWithModifiers = `${string}.${EventModifier}` | `${string}.${EventModifier}.${EventModifier}`

// 数组简写格式
type EventHandlerArray = [
  string,                                 // type: action 类型（目前仅支持 'call'）
  string,                                 // method: 方法名
  unknown[]?,                             // params: 参数
  EventModifier[] | Record<string, boolean>?  // modifiers: 修饰符
]
```

## 最佳实践

1. **优先使用事件名修饰符**：更清晰、更符合 Vue 习惯
2. **常用组合**：
   - 链接：`'click.prevent'`
   - 表单：`'submit.prevent'`
   - 模态框：`'click.self'`
   - 滚动：`'scroll.passive'`
3. **合理使用 .once**：对于只需执行一次的初始化事件
4. **性能敏感场景**：触摸和滚动事件使用 `.passive`
