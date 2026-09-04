# @vario/schema API 参考

## 类型

从 `@variojs/schema` 可导入类型：

- **SchemaNode\<TState\>**、**Schema\<TState\>**
- **LoopConfig**、**ModelScopeConfig**
- **DefineSchemaConfig\<TState, TServices\>**、**VarioView\<TState\>**
- **InferStateType\<T\>**、**InferStateFromConfig\<T\>**、**InferServicesFromConfig\<T\>**
- **SchemaDocument**、**MaterialManifest**、**ActionValidationIssue**

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

## 事件与动作契约

| 函数 | 说明 |
|------|------|
| normalizeEventHandler(handler) | 把 5 种事件处理器写法规范为 Action[] |
| isCallShorthand(handler) | 是否为数组简写 `[call, method, params?, modifiers?]` |
| validateActionPayload(action) | 校验内置 action 的参数结构，返回 issue 或 null |

## 序列化与迁移

| 函数 | 说明 |
|------|------|
| serializeSchema(node) | SchemaNode → JSON 信封字符串（host-only 值摘除） |
| parseSchema(json, options?) | JSON → SchemaDocument（v0/v1 兼容） |
| migrateToV1(input) | 任意输入（裸节点/文档）→ v1 信封 |
| rollbackToV0(doc) | v1 → v0 裸格式（保留 root + materials） |
| migrateIdempotent(doc) | 幂等性验证（二次迁移结果一致） |
| describeDocument(doc) | 返回文档摘要诊断（版本/id/物料清单） |
| wrapLegacy(input, options?) | 迁移 + SCHEMA_MIGRATE 诊断，装载入口用 |

详见[文档与序列化迁移](/packages/schema/document)。

## 物料清单

| 函数 | 说明 |
|------|------|
| validateMaterialManifest(value) | 校验 MaterialManifest，返回 `{ valid, errors }` |

## prepared 编译器（高级）

| 函数 | 说明 |
|------|------|
| prepareView / getPreparedSources / bindPreparedSources / listPreparedNodes | 预编译视图为 prepared 计划 |
| buildPrepareIndex | 构建 prepared 索引 |
| classifyRegion / groupMaximalRegions | 区域划分（static/dynamic/loop/slot/semantic） |
| recompileIncremental | 增量重编译 |
| traverseIterative | 迭代式遍历（防爆栈） |
| EVENT_MODIFIERS / assertSupportedModifiers | 事件修饰符白名单与断言 |
| CanvasWorkspace | 画布工作区（补丁/重排记录） |

## 错误

**SchemaValidationError** 从 `@variojs/schema` 直接导出，用于在 catch 中做 instanceof 判断。
