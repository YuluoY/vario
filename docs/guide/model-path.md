# Model 与路径

Vario 支持智能的 model 路径解析：自动拼接扁平路径，并自动创建缺失的状态结构。行为由 **model 的写法** 决定。

## model 的几种形式

| 写法 | 是否压栈 | 是否在本节点绑定 | 典型用途 |
|------|----------|------------------|----------|
| **字符串路径** `model: "form"` | 压栈 | 绑定 | 普通表单项、嵌套路径根 |
| **字符串** `model: "."` | 不压栈 | 栈非空时绑定到「当前栈路径」 | 循环中绑定到 `items[0]`、`items[1]` 等元素本身 |
| **对象** `model: { path: "form", scope: true }` | 压栈 `path` | **不**绑定 | 仅作层级的容器（如表单根、区块） |

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

## modelPath 配置

仅保留与格式相关的配置（如路径分隔符）：

```typescript
const { state } = useVario(schema, {
  modelPath: { separator: '.' },
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
| 数组访问 `[]` | `model: "users[0].name"` | 明确数组索引 |
| 混合嵌套 | `model: "data[0].items[1].value"` | 自动推断数组/对象 |

**最佳实践**：用 `[]` 明确数组访问；父级用 model 定层级后子级用扁平路径；跨层级用完整路径；循环内用扁平路径利用自动索引。
