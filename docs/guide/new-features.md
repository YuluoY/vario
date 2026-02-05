# 新特性指南 (v0.4.0+)

本文档介绍 Vario v0.4.0 引入的新特性，包括增强的事件系统和指令支持。

## 事件修饰符

### 事件名修饰符（推荐）

直接在事件名中使用 `.` 分隔修饰符，类似 Vue：

```typescript
const schema: SchemaNode = {
  type: 'button',
  events: {
    'click.stop.prevent': 'handleClick'
  },
  children: '点击我'
}
```

**支持的修饰符**：

| 修饰符 | 说明 | DOM API |
|--------|------|---------|
| `.stop` | 阻止事件冒泡 | `event.stopPropagation()` |
| `.prevent` | 阻止默认行为 | `event.preventDefault()` |
| `.self` | 只在事件源是自身时触发 | `event.target === event.currentTarget` |
| `.once` | 事件处理器只触发一次 | - |
| `.capture` | 使用事件捕获模式 | `{ capture: true }` |
| `.passive` | 被动事件监听器 | `{ passive: true }` |

### 事件数组简写格式

事件处理器支持数组简写，格式为：`['call', method, params?, modifiers?]`

```typescript
// 基本用法
events: {
  click: ['call', 'handleClick']
}

// 带参数
events: {
  click: ['call', 'handleClick', ['{{item}}', '{{index}}']]
}

// 带修饰符（数组形式）
events: {
  submit: ['call', 'handleSubmit', [], ['prevent', 'stop']]
}

// 带修饰符（对象形式）
events: {
  submit: ['call', 'handleSubmit', [], { prevent: true, stop: true }]
}
```

**四个固定位置**：
1. **type**: action 类型（目前仅支持 `'call'`）
2. **method**: 方法名
3. **params**: 参数（可选，数组或 `{ params: ... }`）
4. **modifiers**: 修饰符数组或对象（可选）

### 混合使用

事件名修饰符和数组简写修饰符可以组合使用，修饰符会自动合并：

```typescript
events: {
  // 事件名带 stop，数组简写带 prevent，两个都会生效
  'click.stop': ['call', 'handleClick', [], ['prevent']]
}
```

## 自定义指令

### 基本用法

```typescript
// 对象映射形式（最简单）
{
  type: 'input',
  directives: {
    focus: true
  }
}

// 完整对象形式
{
  type: 'div',
  directives: {
    name: 'custom',
    value: '{{someValue}}',
    arg: 'foo',
    modifiers: { bar: true }
  }
}

// 数组简写形式（类似 Vue withDirectives）
{
  type: 'div',
  directives: ['focus', true]
}

// 多个指令
{
  type: 'div',
  directives: [
    ['focus', true],
    ['custom', '{{value}}', 'arg', { lazy: true }]
  ]
}
```

### 注册自定义指令

```typescript
import { useVario } from '@variojs/vue'
import type { Directive } from 'vue'

const myDirective: Directive = {
  mounted(el, binding) {
    console.log('指令挂载:', binding.value)
  },
  updated(el, binding) {
    console.log('指令更新:', binding.value)
  }
}

const { renderSchema } = useVario({
  schema,
  state,
  directives: {
    myDirective  // 在 schema 中使用 directives: { myDirective: true }
  }
})
```

## 实际案例

### 模态框（.self 修饰符）

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
        'click.stop': []  // 阻止冒泡
      },
      children: '弹窗内容'
    }
  ]
}
```

### 表单提交（.prevent 修饰符）

```typescript
const formSchema: SchemaNode = {
  type: 'form',
  events: {
    'submit.prevent': ['call', 'handleSubmit', [], ['stop']]
  },
  children: [
    {
      type: 'input',
      model: 'username',
      directives: { focus: true }  // 自动聚焦
    },
    {
      type: 'button',
      props: { type: 'submit' },
      children: '提交'
    }
  ]
}
```

### 滚动优化（.passive 修饰符）

```typescript
const scrollableSchema: SchemaNode = {
  type: 'div',
  props: { 
    class: 'scrollable',
    style: { height: '300px', overflow: 'auto' }
  },
  events: {
    'scroll.passive': 'handleScroll'  // 优化滚动性能
  },
  children: [...]
}
```

## 最佳实践

### 事件修饰符

1. **优先使用事件名修饰符**：更清晰、更符合 Vue 习惯
2. **常用组合**：
   - 链接：`'click.prevent'`
   - 表单：`'submit.prevent'`
   - 模态框：`'click.self'`
   - 滚动：`'scroll.passive'`
3. **合理使用 .once**：对于只需执行一次的初始化事件
4. **性能敏感场景**：触摸和滚动事件使用 `.passive`

### 指令使用

1. **优先使用对象映射**：简单指令用 `{ focus: true }`
2. **需要参数时使用完整对象**：`{ name, value, arg, modifiers }`
3. **多个指令用数组**：便于管理和复用

## 类型支持

所有新特性都有完整的 TypeScript 类型支持：

```typescript
import type { 
  SchemaNode, 
  EventHandler,
  EventHandlerArray,
  DirectiveConfig,
  DirectiveObject,
  DirectiveArray 
} from '@variojs/schema'

// EventHandlerArray 类型
type EventHandlerArray = readonly [
  string,                                         // type
  string,                                         // method
  (ReadonlyArray<unknown> | undefined)?,          // params
  (string[] | Record<string, boolean> | undefined)?  // modifiers
]

// DirectiveArray 类型
type DirectiveArray = readonly [
  string,                           // name
  (unknown | undefined)?,           // value
  (string | undefined)?,            // arg
  (Record<string, boolean> | undefined)?  // modifiers
]
```

## 迁移指南

### 从 v0.3.x 迁移

1. **移除 eventModifiers 字段**（已废弃）：

```typescript
// ❌ 旧写法（不再支持）
{
  type: 'button',
  events: { click: 'handleClick' },
  eventModifiers: { click: ['stop', 'prevent'] }
}

// ✅ 新写法（推荐）
{
  type: 'button',
  events: {
    'click.stop.prevent': 'handleClick'
  }
}

// ✅ 或使用数组简写
{
  type: 'button',
  events: {
    click: ['call', 'handleClick', [], ['stop', 'prevent']]
  }
}
```

2. **事件数组格式更新**：

```typescript
// ❌ 旧写法（三个位置）
['call', 'method', params]

// ✅ 新写法（四个位置）
['call', 'method', params, modifiers]
```

## 相关文档

- [事件处理](/guide/events)
- [事件修饰符](/guide/event-modifiers)
- [自定义指令](/guide/directives)
- [快速开始](/guide/quick-start)
