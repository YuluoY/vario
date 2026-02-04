# 快速开始

本节用 **@vario/vue** 在 5 分钟内跑通「Schema → 界面」，过程中会用到 **@vario/schema** 的类型与 **@vario/core** 的运行时（由 Vue 集成层封装，无需直接调用）。

## 1. 安装依赖

```bash
pnpm add @variojs/vue @variojs/core @variojs/schema
```

## 2. 写一份最简单 Schema

Schema 是普通对象：`type` 表示节点类型，`children` 是子节点或插值字符串，`model` 表示双向绑定路径。

```typescript
import type { VueSchemaNode } from '@variojs/vue'

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
```

这里用到了：**@vario/schema** 的节点形态、**@vario/core** 的表达式语法 `{{ name }}` 与路径 `name`。类型 `VueSchemaNode` 来自 **@vario/vue**，是对 Schema 节点类型的扩展。

## 3. 在组件里用 useVario 渲染

```typescript
import { useVario } from '@variojs/vue'

export default {
  setup() {
    const { vnode, state } = useVario(schema, {
      state: { name: '' }
    })
    return { vnode, state }
  }
}
```

把 `vnode` 放到模板里渲染即可得到输入框和下方的姓名回显；`state` 由 **@vario/core** 的 RuntimeContext 理念提供，被 **@vario/vue** 包成响应式并同步到界面。

## 4. 加一个“提交”按钮（事件 → Action）

事件通过 Schema 的 `events` 声明，由 **@vario/core** 的 Action VM 执行 `call` 等指令：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    { type: 'input', model: 'name', props: { placeholder: '姓名' } },
    {
      type: 'button',
      events: {
        click: [{ type: 'call', method: 'submit' }]
      },
      children: '提交'
    }
  ]
}

const { vnode, state, methods } = useVario(schema, {
  state: { name: '' },
  methods: {
    submit: ({ ctx }) => {
      console.log('提交', ctx._get('name'))
    }
  }
})
```

`methods.submit` 会在点击时被 VM 的 `call` 动作调用，参数里的 `ctx` 即 **@vario/core** 的 RuntimeContext。

**事件的多种写法**：

```typescript
// 字符串简写（调用方法）
events: { click: 'submit' }

// 数组简写
events: { click: ['call', 'submit'] }

// 带参数
events: { click: ['call', 'submit', { args: ['{{name}}'] }] }

// 事件名带修饰符（推荐）
events: { 'click.stop.prevent': 'submit' }
```

更多事件用法请查看 [事件处理](/guide/events)。

## 5. 使用指令（Directives）

Vario 支持 Vue 风格的指令，可用于 DOM 操作、绑定等场景：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'name',
      directives: { focus: true }, // 对象映射形式
      props: { placeholder: '姓名' }
    },
    {
      type: 'div',
      directives: [
        ['show', '{{name}}'] // 数组简写形式
      ],
      children: 'Hello, {{name}}!'
    }
  ]
}
```

**指令的多种写法**：

```typescript
// 对象映射（简单指令）
directives: { focus: true, loading: '{{isLoading}}' }

// 完整对象
directives: {
  name: 'custom',
  value: '{{someValue}}',
  arg: 'foo',
  modifiers: { bar: true }
}

// 数组简写（类似 Vue 的 withDirectives）
directives: [
  ['focus', true],
  ['show', '{{visible}}'],
  ['custom', '{{value}}', 'arg', { modifier: true }]
]
```

更多指令用法请查看 [指令](/guide/directives)。

## 6. 接下来学什么？

- **只写 Vue 页面**：继续 [状态管理](/guide/state)、[Model 与路径](/guide/model-path)、[事件处理](/guide/events)。
- **想搞懂“状态与表达式从哪来”**：看 [@vario/core 概述](/packages/core/overview) 和 [RuntimeContext](/packages/core/runtime-context)。
- **想严谨定义 Schema**：看 [@vario/schema 概述](/packages/schema/overview) 与 [defineSchema](/packages/schema/define-schema)。
- **想用脚手架与代码生成**：看 [@vario/cli 概述](/packages/cli/overview)。
