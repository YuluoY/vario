# Schema 规范化

**规范化**把“写法多样”的 Schema 转成统一格式，便于渲染层稳定处理，并可为缓存、diff、持久化带来便利。

## 使用方式

```typescript
import { normalizeSchema, normalizeSchemaNode } from '@variojs/schema'

const normalized = normalizeSchema(schema)
// 或单节点
const normalizedNode = normalizeSchemaNode(node)
```

均为**不可变**：返回新对象，不修改入参。

## 做了什么（由简到繁）

- **type**：trim，保证非空。
- **props**：保留键值，对字符串值做 trim；可递归处理嵌套（若存在）。
- **children**：字符串则对插值/空白做统一；数组则对每一项递归 **normalizeSchemaNode**。
- **events**：键名与 Action 列表保留，内部结构按需统一（如去掉空数组、合并相同 type 等，以实现为准）。
- **cond / show**：trim。
- **loop**：保证 `items`、`itemKey` 存在且格式正确，`indexKey` 可选。
- **model**：字符串则 trim；对象则保证 `path` 存在，`scope` 为布尔，`default` 可选。

具体规则以 **normalizer** 源码为准；这里强调的是“输出格式一致、便于比较与缓存”。

## 缓存

**normalizeSchemaNode** 对“同一节点引用”会使用 **WeakMap** 缓存结果，重复规范化同一棵子树时不会重复计算。若 Schema 在运行时被替换成新对象，缓存会按新引用计算，不会误用旧结果。

**clearNormalizationCache**：在需要“强制重新规范化”时（如测试或热更新）可调一次；日常一般不需要。

## 使用场景

- 在 **defineSchema** 或渲染前做一次 **normalizeSchema**，后续都用规范化结果，减少分支逻辑。
- 做 Schema diff / 快照时，先规范化再比较，避免因空格、顺序导致的假差异。
- 与 [验证](/packages/schema/validation) 配合：先 **validateSchema**，再 **normalizeSchema**，再交给渲染或存储。
