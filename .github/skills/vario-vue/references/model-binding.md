# Model Binding — Deep Reference

> 读取时机：用户处理双向绑定、路径栈、嵌套表单、命名模型、自定义组件绑定协议、model 修饰符时读取。

## Table of Contents
1. [Path Formats](#path-formats)
2. [Path Stack Mechanics](#path-stack-mechanics)
3. [Auto-Detection Chain](#auto-detection-chain)
4. [Named Models (Multi v-model)](#named-models)
5. [Modifiers](#modifiers)
6. [Default Values](#default-values)
7. [Custom Binding Protocol (registerModelConfig)](#custom-binding-protocol)
8. [Model Options](#model-options)
9. [Loop Context Model Binding](#loop-context-model-binding)

---

## Path Formats

源码：`packages/vario-vue/src/path-resolver.ts` — `ModelPathResolver`

### 1. Flat Path（单段路径）
```json
{ "type": "ElInput", "model": "name" }
```
单段路径 **追加到当前路径栈顶**。若父级 scope 为 `form.user`，则实际绑定 `form.user.name`。

### 2. Explicit Path（多段路径）
```json
{ "type": "ElInput", "model": "form.user.email" }
```
多段路径（含 `.`）**替换**当前路径栈，成为新的栈基准。

### 3. Array Access
```json
{ "type": "ElInput", "model": "users[0].name" }
```
支持方括号索引，`resolveModelPath()` 会在解析时处理数组下标。

### 4. Expression Path
```json
{ "type": "ElInput", "model": "{{ dynamicField }}" }
```
`extractModelPath()` 检测到 `{{ }}` 包裹时，先 evaluate 表达式得到真实路径字符串，再递归调用 `resolveModelPath()`。

### 5. Scope Container
```json
{ "type": "div", "model": { "path": "form", "scope": true },
  "children": [
    { "type": "ElInput", "model": "name" }
  ]
}
```
`scope: true` 使该节点将 `form` 推入路径栈。子节点 `name` → 实际路径 `form.name`。

### 6. Dot Binding（绑定自身）
```json
{ "loop": { "items": "{{ tags }}", "itemKey": "tag" },
  "children": [{ "type": "ElInput", "model": "." }]
}
```
`"."` 表示绑定到**当前路径栈的完整路径**，在 loop 中即循环项本身。

### 7. Object Config
```json
{ "type": "ElInput", "model": { "path": "search", "default": "", "modifiers": { "trim": true } } }
```
完整对象 `{ path, scope?, default?, modifiers? }`。

---

## Path Stack Mechanics

路径栈（`modelPathStack: string[]`）由 `updateModelPathStack()` 维护：

```
初始栈: []
父节点 model: { path: "form", scope: true }  → 栈: ["form"]
子节点 model: { path: "user", scope: true }  → 栈: ["form", "user"]
叶子节点 model: "name"                        → 绑定到 "form.user.name"
```

**关键规则：**
- `getScopePath()` 仅在 `path` 为字符串或 `scope: true` 的对象时返回非 null 路径，否则不推入栈
- Flat path（`name`）→ 追加到栈顶
- Explicit path（`a.b.c`）→ 替换整个栈
- Loop 变量检测：若 path 等于 `$item` 或 loop 的 `itemKey`，则视为循环变量引用，不推栈
- Expression path → evaluate 后检查结果类型
- 动态索引 `-1` → 替换为 `ctx.$index`

### 栈可视化示例

```
Schema:
├── div (model: { path: "order", scope: true })    stack: ["order"]
│   ├── ElInput (model: "id")                       → "order.id"
│   ├── div (model: { path: "items[0]", scope: true })  stack: ["order", "items[0]"]
│   │   └── ElInput (model: "name")                 → "order.items[0].name"
│   └── ElInput (model: "total")                    → "order.total"
```

---

## Auto-Detection Chain

源码：`packages/vario-vue/src/bindings.ts` — `getModelConfig()`

四步优先级链，返回 `{ prop, event, defaultValue }`:

```
1. customConfigs.get(type)     ← registerModelConfig() 注册的自定义配置
2. NATIVE_FORM_ELEMENTS[type]  ← 原生 HTML 元素内置映射
3. component inspection        ← 检查组件的 model/emits 定义
4. Vue 3 default               ← { prop: 'modelValue', event: 'update:modelValue' }
```

**原生元素内置映射 (`NATIVE_FORM_ELEMENTS`):**

| Element | prop | event |
|---------|------|-------|
| `input` | `value` | `input` |
| `textarea` | `value` | `input` |
| `select` | `value` | `change` |
| `input[type=checkbox]` | `checked` | `change` |
| `input[type=radio]` | `checked` | `change` |

**组件检测 (Step 3):**
- 检查组件 `model` 属性 → `{ prop: comp.model.prop, event: comp.model.event }`
- 检查组件 `emits` 是否包含 `'update:modelValue'` → 标准 Vue 3 协议

---

## Named Models

源码：`getNamedModelConfig()` in `bindings.ts`

Vue 3.4+ 支持多 v-model。在 Schema 中使用 `model:propName` 键：

```json
{
  "type": "UserEditor",
  "model": "user",
  "model:firstName": "user.first",
  "model:lastName": "user.last"
}
```

生成的 attrs:
```
{ modelValue: state.user, 'onUpdate:modelValue': ...,
  firstName: state.user.first, 'onUpdate:firstName': ...,
  lastName: state.user.last, 'onUpdate:lastName': ... }
```

`getNamedModelConfig(propName)` 返回 `{ prop: propName, event: \`update:${propName}\` }`。

---

## Modifiers

源码：`createModelBinding()` in `bindings.ts`

### 声明方式
```json
{ "model": { "path": "name", "modifiers": { "trim": true, "number": true } } }
{ "model": { "path": "name", "modifiers": ["trim", "number"] } }
```

### 执行顺序
**trim → number → lazy**。无论声明顺序如何，内部固定按此顺序应用。

### 修饰符行为

**`.trim`**: 对收到的事件值执行 `String(val).trim()`，仅在末尾注册 blur 事件重新设置。

**`.number`**: 将值转换为数字（`parseFloat`），如果不是有效数字则保留原值。

**`.lazy`**: 将事件从 `input` 改为 `change`，延迟激活（使用 `setTimeout(fn, 0)` 避免初始渲染导致的过早触发）。

### createModelBinding 返回结构
```typescript
interface ModelBindingResult {
  [prop: string]: currentValue          // 绑定到 state 路径的值
  [event: string]: (newVal) => void     // 更新回调
}
```

---

## Default Values

`getDefaultValue()` 逻辑：
- 若 model 配置中有 `default` → 使用该值
- 若 prop 是 `'value'` 或 `'modelValue'` → 默认 `''`
- 若 prop 是 `'checked'` → 默认 `false`
- 其他 → `undefined`

`modelOptions.lazy` (全局) 为 `true` 时，不预写 default 到 state，仅在组件交互时才设值。

---

## Custom Binding Protocol

```typescript
import { registerModelConfig, clearModelConfigs } from '@variojs/vue'

// 注册自定义组件的绑定协议
registerModelConfig('MySwitch', {
  prop: 'checked',
  event: 'change',
  defaultValue: false
})

// 或通过 useVario options
useVario(schema, {
  modelBindings: {
    'MySwitch': { prop: 'checked', event: 'change' }
  }
})

// 清除所有自定义配置
clearModelConfigs()
```

优先级最高，覆盖所有自动检测结果。

---

## Model Options

```typescript
useVario(schema, {
  modelOptions: {
    separator: '.',     // 路径分隔符（默认 '.'）
    lazy: false         // 全局惰性模式（默认 false）
  }
})
```

- `lazy: true` → model 绑定不预初始化 state 中的默认值，等组件交互时才写入
- `separator` → 用于路径解析的分隔字符

---

## Loop Context Model Binding

在 loop 中使用 model 有特殊处理：

```json
{
  "loop": { "items": "{{ users }}", "itemKey": "user", "indexKey": "idx" },
  "model": { "path": "users", "scope": true },
  "children": [
    { "type": "ElInput", "model": "name" }
  ]
}
```

**处理流程：**
1. `LoopHandler` 检测到 `model` 与 `items` 路径重合时，从子 schema 移除 model（避免重复绑定）
2. 循环为每项创建 scope path：`users[0]`, `users[1]`, ...
3. 子节点 `model: "name"` → 在栈中解析为 `users[0].name`, `users[1].name`, ...
4. 动态索引 `-1` 在 `resolveModelPath()` 中替换为 `ctx.$index`

**绑定到循环项本身：**
```json
{ "type": "ElInput", "model": "." }
```
→ 解析为 `users[0]`, `users[1]`, ... （直接绑定到数组元素）
