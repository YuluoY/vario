# @vario/schema API 参考

## 类型

从 `@variojs/schema` 可导入类型：

- **SchemaNode\<TState\>**、**Schema\<TState\>**
- **LoopConfig**、**ModelScopeConfig**
- **DefineSchemaConfig\<TState, TServices\>**、**VarioView\<TState\>**
- **InferStateType\<T\>**、**InferStateFromConfig\<T\>**、**InferServicesFromConfig\<T\>**

## 验证

| 函数 | 说明 |
|------|------|
| validateSchema(schema, options?) | 递归校验，失败抛 SchemaValidationError |
| validateSchemaNode(node, path?, options?) | 校验单节点 |
| validateSchemaWithResult(schema, options?) | 返回 { valid, errors }，不抛错 |

**ValidationOptions**：validateExpressions、validatePaths、customValidators。

**SchemaValidationError**：path、message、code、context。

## 规范化

| 函数 | 说明 |
|------|------|
| normalizeSchema(schema) | 整棵树规范化 |
| normalizeSchemaNode(node) | 单节点规范化（带缓存） |
| clearNormalizationCache() | 清空规范化缓存 |

## 转换与 defineSchema

| 函数 / 类 | 说明 |
|-----------|------|
| defineSchema(config) | 返回 VarioView，含 schema、类型推导 |
| extractSchema(viewOrNode) | 从 VarioView 或节点提取 Schema |
| isSchemaNode(x) | 类型守卫：是否为 SchemaNode |
| DefineSchemaConfigError | defineSchema 的配置/执行/校验错误 |

## 错误

**SchemaValidationError** 从 `@variojs/schema` 直接导出，用于在 catch 中做 instanceof 判断。
