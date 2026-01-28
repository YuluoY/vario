# Schema 验证

**@vario/schema** 的校验用于在运行时尽早发现“结构错误、非法表达式、非法路径”，避免渲染或执行到一半再报错。

## 使用方式

### validateSchema

对整棵 Schema 做递归校验，失败时抛出 **SchemaValidationError**：

```typescript
import { validateSchema, SchemaValidationError } from '@variojs/schema'

try {
  validateSchema(schema)
} catch (e) {
  if (e instanceof SchemaValidationError) {
    console.error(e.path, e.message, e.code)
  }
}
```

### validateSchemaNode

对单个节点校验，常用于自定义工具或逐段校验：

```typescript
import { validateSchemaNode } from '@variojs/schema'

validateSchemaNode(node, 'root.children[0]', options)
```

### validateSchemaWithResult

不抛错，返回结果对象，便于批量收集错误：

```typescript
import { validateSchemaWithResult } from '@variojs/schema'

const result = validateSchemaWithResult(schema, options)
if (!result.valid) {
  result.errors.forEach(err => console.error(err.path, err.message))
}
```

## 校验内容（由简到繁）

1. **结构**：节点必须是对象；必有非空 `type`；`props` 为对象；`children` 为数组或字符串；`events` 为「事件名 → Action[]」；`loop` 符合 LoopConfig；`model` 为字符串或 ModelScopeConfig。
2. **表达式**：对 `cond`、`show`、`children` 中的 `{{ }}`、以及 `loop.items` 等做 **parseExpression + validateAST**（白名单与安全规则与 Core 一致）。
3. **路径**：对 `model`、`loop.items` 等路径形式做合法性与可解析性检查（若开启 `validatePaths`）。

## ValidationOptions

- **validateExpressions**：是否校验表达式（默认 true）。
- **validatePaths**：是否校验路径（默认 true）。
- **customValidators**：`(node, path) => void` 数组，可在此基础上加业务规则（如禁止某些 type、限制嵌套深度等）。

## SchemaValidationError

- **path**：出错节点路径，如 `'root.children[1]'`。
- **message**：简短说明。
- **code**：错误码，便于做 i18n 或统计。
- **context**：可含 `node`、`suggestion` 等，用于提示或自动修复。

在 [规范化](/packages/schema/normalization) 之前或与 **defineSchema** 配合时，建议先 **validateSchema**，再交给渲染层或持久化。
