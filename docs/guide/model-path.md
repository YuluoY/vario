# Model 与路径

Vario 支持智能的 model 路径解析：自动拼接扁平路径，并自动创建缺失的状态结构。行为由 **model 的写法** 决定。

## model 的几种形式

| 写法 | 是否压栈 | 是否在本节点绑定 | 典型用途 |
|------|----------|------------------|----------|
| **字符串路径** `model: "form"` | 压栈 | 绑定 | 普通表单项、嵌套路径根 |
| **字符串** `model: "."` | 不压栈 | 栈非空时绑定到「当前栈路径」 | 循环中绑定到 `items[0]`、`items[1]` 等元素本身 |
| **对象** `model: { path: "form", scope: true }` | 压栈 `path` | **不**绑定 | 仅作层级的容器（如表单根、区块） |
| **对象** `model: { path: "name", default: "张三" }` | 压栈 | 绑定 | 状态未初始化时使用默认值并写回状态 |
| **对象** `model: { path: "optional", lazy: true }` | 压栈 | 绑定 | 惰性：不预写 state，仅当用户修改该绑定值后才写入 |

子节点的扁平路径会自动与父级路径栈拼接。

## 使用 scope 的容器（仅作用域、不绑定）

```typescript
const schema: VueSchemaNode = {
  type: 'form',
  model: { path: 'form', scope: true },
  children: [
    { type: 'input', model: 'name' },   // → form.name
    { type: 'input', model: 'email' }   // → form.email
  ]
}
```

## 默认值（default）

当使用对象形式且不设 `scope: true` 时，可加 `default`。状态中该路径为 `undefined` 时，会用 `default` 初始化并写回状态：

```typescript
{ type: 'ElInput', model: { path: 'name', default: '张三' } }
{ type: 'ElCheckbox', model: { path: 'agreed', default: true } }
```

## 惰性（lazy）

当使用对象形式且不设 `scope: true` 时，可加 `lazy: true`。此时不会预写 state：该路径在状态中保持未定义，组件仍显示默认值（如空字符串）；仅当用户修改该绑定值后才会写入 state。

```typescript
{ type: 'ElInput', model: { path: 'optional', lazy: true } }
```

适用于可选字段，希望 state 只包含用户实际填写的内容。

**整棵 schema 默认惰性**：在 `useVario` 的 options 中设置 `modelOptions: { lazy: true }`，则所有未在节点上显式设置 `lazy` 的 model 均不预写 state；节点上可单独写 `lazy: false` 覆盖。

```typescript
const { vnode, state } = useVario(schema, { state: {}, modelOptions: { lazy: true } })
```

## 明确路径与扁平路径

使用完整路径时直接使用，不会拼接。容器建议用 `scope`：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  model: { path: 'form', scope: true },
  children: [
    { type: 'input', model: 'form.user.name' },  // 明确路径
    { type: 'input', model: 'name' }             // 扁平路径 → form.name
  ]
}
```

## 数组访问语法 `[]`

```typescript
model: 'users[0].name'   // 明确数组访问，自动创建 state.users 为数组
model: 'users[1].email'
```

## 嵌套与循环中的路径

循环层用 `model: { path: 'users', scope: true }`，子节点用扁平路径即可自动变成 `users[0].name`、`users[1].name` 等。

**绑定到数组元素本身**：在循环内使用 `model: "."`，表示绑定到当前循环项（如 `state.items[0]`、`state.items[1]`）本身。

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  loop: { items: 'items', itemKey: 'it' },
  model: { path: 'items', scope: true },
  children: [
    { type: 'input', model: '.' }  // 绑定到 items[0]、items[1] 本身
  ]
}
const { state } = useVario(schema, { state: { items: ['', ''] } })
// 第 1 行输入 "a" → state.items[0] === 'a'
```

## modelOptions 配置

路径分隔符与默认惰性等：

```typescript
const { state } = useVario(schema, {
  modelOptions: { separator: '.', lazy: true },
  state: {}
})
```

## 路径语法与 model 写法总结

| 类型 | 示例 | 说明 |
|------|------|------|
| 扁平路径 | `model: "name"` | 自动拼接父级路径栈 |
| 明确路径 | `model: "form.user.name"` | 直接使用 |
| 当前栈路径 | `model: "."` | 绑定到当前路径栈（循环中即元素本身） |
| 作用域（不绑定） | `model: { path: "form", scope: true }` | 仅压栈，本节点不绑定 |
| 默认值 | `model: { path: "name", default: "张三" }` | 状态未初始化时用默认值并写回 |
| 惰性 | `model: { path: "optional", lazy: true }` | 不预写 state，仅用户修改后写入 |
| 数组访问 `[]` | `model: "users[0].name"` | 明确数组索引 |
| 混合嵌套 | `model: "data[0].items[1].value"` | 自动推断数组/对象 |

**最佳实践**：用 `[]` 明确数组访问；父级用 model 定层级后子级用扁平路径；跨层级用完整路径；循环内用扁平路径利用自动索引。
