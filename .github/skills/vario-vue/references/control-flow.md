# Control Flow & Expressions — Deep Reference

> 读取时机：用户使用 cond/show 条件渲染、loop 循环渲染、表达式求值、文本插值、slots 时读取。

## Table of Contents
1. [条件渲染 — cond](#条件渲染--cond)
2. [可见性控制 — show](#可见性控制--show)
3. [循环渲染 — loop](#循环渲染--loop)
4. [表达式求值](#表达式求值)
5. [文本插值](#文本插值)
6. [插槽 (Slots)](#插槽-slots)

---

## 条件渲染 — cond

等效于 Vue 的 `v-if`。表达式为 falsy 时节点 **不渲染**（返回 `null`），完全移除 DOM。

```json
{ "type": "div", "cond": "isLoggedIn" }
{ "type": "div", "cond": "items.length > 0" }
{ "type": "div", "cond": "{{ user && user.role === 'admin' }}" }
```

### 实现细节
在 `VueRenderer.createVNode()` 的 **最早阶段** 求值（步骤 1），如果为 falsy 立即返回 `null`，跳过后续所有处理：

```
createVNode(schema, ctx, ...):
  1. cond 求值 → falsy → return null   ← 最早退出
  2. show 求值（给 path-memo 用）
  3. path-memo 缓存检查
  4. Scope-Weight 组件化检查
  5. loop 处理
  ...
```

- 表达式错误 → 渲染红色错误提示 div
- cond 求值结果同时用于 path-memo 的 `depsKey`

### v-if / v-else-if / v-else 等价

Vario 不支持 `v-else`，用互补 cond 实现：
```json
[
  { "type": "div", "cond": "status === 'loading'", "children": "加载中..." },
  { "type": "div", "cond": "status === 'error'", "children": "出错了" },
  { "type": "div", "cond": "status === 'success'", "children": "完成" }
]
```

---

## 可见性控制 — show

等效于 Vue 的 `v-show`。节点**始终渲染**，falsy 时添加 `display: none` 样式。

```json
{ "type": "div", "show": "isVisible" }
{ "type": "div", "show": "{{ count > 0 }}" }
```

### 样式合并逻辑
当 show 为 falsy 时，与已有 style 合并：
- **已有 style 为字符串**：先解析为对象，再追加 `display: 'none'`
- **已有 style 为对象/undefined**：直接扩展 `{ ...currentStyle, display: 'none' }`

```typescript
// 字符串 style → 对象
"color: red; font-size: 14px" → { color: 'red', 'font-size': '14px', display: 'none' }
// 对象 style → 合并
{ color: 'red' } → { color: 'red', display: 'none' }
```

- 表达式错误 → `console.warn` + 默认隐藏元素
- show 求值结果也用于 path-memo 的 `depsKey`

---

## 循环渲染 — loop

等效于 Vue 的 `v-for`。

### 基本语法
```json
{
  "type": "div",
  "loop": {
    "items": "users",
    "itemKey": "user",
    "indexKey": "index"
  },
  "children": "{{ user.name }} - #{{ index }}"
}
```

| 字段 | 说明 | 必填 |
|------|------|------|
| `items` | 数据源路径（表达式，必须求值为数组） | 是 |
| `itemKey` | 循环变量名（注入到 loopCtx） | 是 |
| `indexKey` | 索引变量名（注入到 loopCtx） | 否 |

### 实现流程（LoopHandler.createLoopVNode）

```
1. 提取 items 路径 → extractModelPath(loop.items)
2. 对数据源求值 → evaluateExpr(itemsPath, ctx)
   - 非数组 → 红色错误 div
   - 空数组 → return null
3. 处理节点自身 model（scope 压栈）
4. 创建循环子节点：
   for each (item, index):
     a. 复制 schema，删除 loop 属性
     b. 如果 model 路径 === items 路径 → 删除 model（避免重复绑定）
     c. markLoopSchema → 递归写入 __loopItems 标记
     d. 计算 loopPathStack: [...basePathStack, index]
     e. 计算 itemPath: "[0]", "[1]", ...
     f. 获取 key: itemKey 属性值 → id → fall back to index
     g. 如果模板权重 > COMPONENT_OVERHEAD → h(LoopItemCell, props)
        else → createLoopContext(ctx, item, index) → createVNode(childSchema, loopCtx, ...)
5. 返回 h(Fragment, null, children)
```

### Key 优先级
1. `item[loop.itemKey]`（如 `user.user` — 一般不匹配，应使用如 `user.id`）
2. `item.id`
3. `index`（不推荐，导致 diff 效率差）

注意：实际逻辑中 `itemKey` 同时用作循环变量名和 key 属性名。如果 item 对象包含与 `itemKey` 同名的属性，该属性值即为 key。

### __loopItems 标记
`markLoopSchema()` 递归给子 schema 打上 `__loopItems` 标记。这使得：
- 事件处理器跳过缓存（因为包含闭包捕获的循环变量）
- path-memo 通过 `isLoopItem = path.includes('[')` 检测跳过

### 嵌套循环
天然支持嵌套，内层循环可访问外层变量（通过 loopCtx 的原型链）：
```json
{
  "type": "div", "loop": { "items": "groups", "itemKey": "group" },
  "children": [{
    "type": "span", "loop": { "items": "{{ group.members }}", "itemKey": "member" },
    "children": "{{ member.name }}"
  }]
}
```

---

## 表达式求值

源码：`packages/vario-vue/src/features/expression-evaluator.ts`

### 语法
- `{{ expression }}` — 标准模板表达式格式
- 纯表达式（不含 `{{ }}`）— 在 cond/show/items 等字段中自动作为表达式求值

### 处理流程
```
ExpressionEvaluator.evaluateExpr(expr, ctx)
  → extractExpression(expr)   // @variojs/core：去除 {{ }} 包装
  → evaluate(finalExpr, ctx)  // @variojs/core：沙箱化求值
  → result (any)
  → 错误 → return undefined
```

### 求值环境（ctx）
表达式可访问：
- `state` 中的所有属性（顶层属性直接访问）
- 循环变量（`item`, `index` 等）
- `methods` 中注册的方法
- 通过 `inject` 注入的值

### Props 中的表达式
`ChildrenResolver.evalProps()` 递归处理 props 中的表达式：
```json
{
  "type": "ElTag",
  "props": {
    "type": "{{ item.status === 'active' ? 'success' : 'info' }}",
    "size": "small",
    "data": { "label": "{{ item.name }}" }
  }
}
```

处理规则：
- `{{ expr }}` 开头且结尾 → 提取并求值，返回任意类型
- 字符串中混合文本和 `{{ expr }}` → 文本插值，结果为字符串
- 嵌套对象/数组 → 递归处理

---

## 文本插值

在 `children` 为字符串时，支持 `{{ expression }}` 插值：

```json
{ "type": "span", "children": "Hello {{ user.name }}, you have {{ count }} messages" }
```

### 实现
`ChildrenResolver.resolveTextContent()` 使用正则 `/\{\{\s*([^}]+)\s*\}\}/g` 替换所有匹配：
- 求值成功 → `String(value)`，`null/undefined` → 空字符串
- 求值失败 → 保留原始 `{{ expression }}` 文本 + `console.warn`

---

## 插槽 (Slots)

### 检测条件
children 中存在 `type: 'template'` 且带有 `slot` 属性的节点：

```json
{
  "type": "ElTable",
  "children": [
    {
      "type": "template",
      "slot": "header",
      "children": [{ "type": "h3", "children": "表头" }]
    },
    {
      "type": "template",
      "slot": "default",
      "children": [{ "type": "span", "children": "内容" }]
    }
  ]
}
```

### 作用域插槽
通过 `props.scope` 指定作用域变量名：

```json
{
  "type": "ElTable",
  "props": { "data": "{{ tableData }}" },
  "children": [{
    "type": "template",
    "slot": "default",
    "props": { "scope": "scope" },
    "children": [{
      "type": "span",
      "children": "{{ scope.row.name }}"
    }]
  }]
}
```

### 实现细节
`ChildrenResolver.resolveSlots()` 返回 `Record<string, (scope?) => VNode[]>`：

1. 遍历 children，识别 template+slot 节点
2. 对每个 slot，创建渲染函数：
   - 有 `scope` → `Object.create(ctx)` 创建子上下文，注入 scope 变量
   - 渲染 template 的 children
3. 非 slot 的普通子节点收集到 `regularChildren`
4. 如果有 regularChildren 且无 default slot → 创建 default slot 返回它们
5. 如果有 regularChildren 且有 default slot → 合并到 default

### 注意事项
- 事件处理器对 slot 内容跳过 WeakMap 缓存（因为 scope 影响闭包）
- 作用域插槽中也可以使用 model 绑定和事件
