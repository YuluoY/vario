# 类型与 Schema 节点

Schema 用树形 **SchemaNode** 描述界面：每个节点有 **type**，可有 **props**、**children**、**events**、**cond**、**show**、**loop**、**model** 等。渲染层按这棵抽象树生成具体组件或 DOM。

## SchemaNode 基础

```typescript
import type { SchemaNode } from '@variojs/schema'

const node: SchemaNode = {
  type: 'div',
  props: { class: 'container' },
  children: [
    { type: 'span', children: 'Hello' },
    { type: 'input', model: 'name', props: { placeholder: '姓名' } }
  ]
}
```

- **type**（必填）：组件类型或 HTML 标签名，如 `'div'`、`'ElButton'`。
- **props**：键值对，值可为字符串（含表达式插值，由渲染层求值）。
- **children**：`SchemaNode[]` 或字符串；字符串里可写 `{{ expr }}`，由 Core 表达式求值。

## 条件与显示

- **cond**：表达式为真时渲染该节点（等效 v-if）。
- **show**：表达式为真时显示（等效 v-show，用样式控制）。

```typescript
{ type: 'div', cond: 'user.age >= 18', children: '成人内容' }
{ type: 'div', show: 'isVisible', children: '...' }
```

## 循环 loop

```typescript
import type { LoopConfig } from '@variojs/schema'

{
  type: 'div',
  loop: {
    items: '{{ list }}',   // 数据源表达式
    itemKey: 'item',
    indexKey: 'index'      // 可选
  },
  children: [{ type: 'div', children: '{{ index + 1 }}. {{ item.name }}' }]
}
```

**LoopConfig**：`items`（表达式）、`itemKey`、`indexKey?`。渲染层会对 `items` 求值得到数组，再对每一项创建循环上下文（$item、$index）。

## 双向绑定 model

- **字符串**：绑定到该路径，并参与路径栈（子节点可写相对路径）。
- **对象**：`{ path: string, scope?: boolean }`。`scope: true` 表示仅作子节点路径根，本节点不绑定。

```typescript
{ type: 'input', model: 'user.name', props: { placeholder: '姓名' } }
{ type: 'form', model: { path: 'form', scope: true }, children: [
  { type: 'input', model: 'name' }  // 等价 form.name
]}
```

## 事件 events

```typescript
{
  type: 'button',
  events: {
    click: [{ type: 'call', method: 'submit' }],
    blur: [{ type: 'set', path: 'touched', value: true }, { type: 'emit', event: 'blur' }]
  },
  children: '提交'
}
```

键为事件名，值为 **Action** 数组，由 Core 的 VM 执行。Action 的 type 包括 set、call、emit、if、loop、batch 等，见 [@vario/core Action VM](/packages/core/action-vm)。

## Schema 根与泛型

- **Schema\<TState\>**：整棵树的根类型，一般就是 **SchemaNode\<TState\>**。
- **SchemaNode\<TState\>**：可带状态泛型，用于在 defineSchema 或类型工具里推导“该 Schema 依赖的状态形状”。

## ModelScopeConfig、LoopConfig

- **ModelScopeConfig**：`{ path: string; scope?: boolean }`，仅用于 model 的对象形式。
- **LoopConfig**：`{ items: string; itemKey: string; indexKey?: string }`。

在 [验证](/packages/schema/validation) 中会说明这些字段如何在运行时被校验。
