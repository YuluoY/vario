# v-model 修饰符

Vario 完整支持 Vue 3 风格的 v-model 修饰符，包括 `.trim`、`.number` 和 `.lazy`。

## 基础用法

### .trim 修饰符

去除输入值的首尾空格：

```json
{
  "type": "input",
  "model": {
    "path": "username",
    "modifiers": ["trim"]
  }
}
```

用户输入 `"  hello  "` 时，state 中会保存为 `"hello"`。

### .number 修饰符

自动将输入值转换为数字类型：

```json
{
  "type": "input",
  "model": {
    "path": "age",
    "modifiers": ["number"]
  }
}
```

用户输入 `"25"` 时，state 中会保存为数字 `25`。

### .lazy 修饰符

改用 `change` 事件而不是 `input` 事件来更新状态（失焦或按回车时更新）：

```json
{
  "type": "input",
  "model": {
    "path": "text",
    "modifiers": ["lazy"]
  }
}
```

## 组合修饰符

可以同时使用多个修饰符：

```json
{
  "type": "input",
  "model": {
    "path": "count",
    "modifiers": ["trim", "number"]
  }
}
```

用户输入 `"  42  "` 时，会先去除空格，再转换为数字，最终保存为 `42`。

## 两种语法形式

### 数组形式

```json
{
  "type": "input",
  "model": {
    "path": "value",
    "modifiers": ["trim", "lazy"]
  }
}
```

### 对象形式

```json
{
  "type": "input",
  "model": {
    "path": "value",
    "modifiers": {
      "trim": true,
      "lazy": true
    }
  }
}
```

两种形式功能完全相同，选择你喜欢的即可。

## 具名 model 修饰符

具名 model 也完全支持修饰符：

```json
{
  "type": "CustomComponent",
  "model:value": {
    "path": "text",
    "modifiers": ["trim"]
  },
  "model:count": {
    "path": "num",
    "modifiers": ["number"]
  }
}
```

## 与其他选项组合

修饰符可以与 `default` 和 `lazy` 选项一起使用：

```json
{
  "type": "input",
  "model": {
    "path": "price",
    "default": 0,
    "lazy": true,
    "modifiers": ["trim", "number"]
  }
}
```

## 修饰符详解

| 修饰符 | 作用 | 示例输入 | 结果 |
|--------|------|----------|------|
| `.trim` | 去除首尾空格 | `"  hello  "` | `"hello"` |
| `.number` | 转换为数字 | `"99.99"` | `99.99` |
| `.lazy` | 使用 change 事件 | - | 失焦时才更新 |

### .number 详细说明

- 能够正确处理小数：`"99.99"` → `99.99`
- 无法转换时保留原字符串：`"abc"` → `"abc"`
- 转换发生在值更新到 state 之前

### .lazy 详细说明

- 对于原生 `input` 元素：从 `input` 事件改为 `change` 事件
- 对于 Vue 组件：从 `update:modelValue` 改为 `change:modelValue`（如果组件支持）
- 适用于减少频繁更新，提升性能

## 执行顺序

当同时使用多个修饰符时，执行顺序为：

1. `.trim` - 先去除空格
2. `.number` - 再转换为数字
3. `.lazy` - 修改事件监听

```json
{
  "type": "input",
  "model": {
    "path": "value",
    "modifiers": ["trim", "number", "lazy"]
  }
}
```

用户失焦并输入 `"  42  "` 时：
1. trim: `"  42  "` → `"42"`
2. number: `"42"` → `42`
3. 结果：state 保存为数字 `42`

## TypeScript 类型定义

```typescript
interface ModelScopeConfig {
  path: string
  scope?: boolean
  default?: unknown
  lazy?: boolean
  modifiers?: string[] | Record<string, boolean>
}
```

## 实现原理

修饰符在 `createModelBinding` 阶段处理：

1. 从 model 配置中提取 modifiers
2. 创建转换函数 `applyModifiers`
3. 在事件处理器中应用转换
4. 将转换后的值写入 state

这确保修饰符逻辑与 Vue 原生行为保持一致。

## 注意事项

### 字符串形式的 model 不支持修饰符

❌ 不支持：
```json
{
  "type": "input",
  "model": "text"  // 字符串形式
}
```

✅ 支持：
```json
{
  "type": "input",
  "model": {
    "path": "text",
    "modifiers": ["trim"]
  }
}
```

### .number 对非数字字符串的处理

```json
{
  "type": "input",
  "model": {
    "path": "value",
    "modifiers": ["number"]
  }
}
```

- 输入 `"123"` → `123` ✅
- 输入 `"abc"` → `"abc"` (保留原样，因为无法转换)
- 输入 `"12.34"` → `12.34` ✅

## 最佳实践

### 数字输入框

```json
{
  "type": "input",
  "props": {
    "type": "number",
    "placeholder": "请输入年龄"
  },
  "model": {
    "path": "age",
    "modifiers": ["number"],
    "default": 0
  }
}
```

### 搜索框（减少更新频率）

```json
{
  "type": "input",
  "props": {
    "placeholder": "搜索..."
  },
  "model": {
    "path": "searchText",
    "modifiers": ["trim", "lazy"]
  }
}
```

### 价格输入

```json
{
  "type": "input",
  "props": {
    "type": "text",
    "placeholder": "0.00"
  },
  "model": {
    "path": "price",
    "modifiers": ["trim", "number"],
    "default": 0
  }
}
```

## 与 Vue 的区别

Vario 的修饰符实现与 Vue 3 原生行为完全一致：

| 特性 | Vue 3 | Vario |
|------|-------|-------|
| `.trim` | ✅ | ✅ |
| `.number` | ✅ | ✅ |
| `.lazy` | ✅ | ✅ |
| 组合使用 | ✅ | ✅ |
| 具名 model 支持 | ✅ | ✅ |

唯一的区别是语法形式：Vue 使用模板指令，Vario 使用 JSON Schema。
