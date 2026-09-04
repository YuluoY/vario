# SchemaDocument 与序列化迁移

单个 **SchemaNode** 只描述界面树；存储、跨端传输和版本治理还需要一层**文档信封**——**SchemaDocument**。@variojs/schema 围绕它提供三组能力：**序列化（codec）**、**版本迁移（migrations）**、**物料清单（material-manifest）**。

## SchemaDocument 结构

```typescript
import type { SchemaDocument } from '@variojs/schema'

const doc: SchemaDocument = {
  version: 1,              // 文档版本：0 = 裸 SchemaNode，1 = 完整信封
  schemaVersion: 1,        // 可选：schema 结构自身的版本，与文档版本分离
  id: 'page:order-detail', // 可选：文档 ID
  root: {                  // ★ schema 根节点（必填）
    type: 'div',
    children: []
  },
  initialState: { rows: [] },              // 可选：文档自带初始 state
  materials: [],                           // 可选：物料清单（见下文）
  materialVersions: { ElTable: '2.5.0' },  // 可选：物料版本映射
  extensions: { source: 'lowcode-editor' } // 可选：自定义扩展数据
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `version` | ✅ | `0`（裸节点，历史格式）或 `1`（信封格式） |
| `root` | ✅ | SchemaNode 根节点 |
| `schemaVersion` | | schema 结构版本，与 `version` 解耦，便于信封不变而节点结构演进 |
| `id` | | 文档标识；缺省时迁移器会取 `root.id`，再回退 `'doc:root'` |
| `initialState` | | 文档级初始状态 |
| `materials` / `materialVersions` | | 物料清单及版本（见[物料清单](#物料清单-materialmanifest)） |
| `extensions` | | 任意扩展元数据，核心不解释 |

## 序列化（codec）

```typescript
import { serializeSchema, parseSchema } from '@variojs/schema'

// 序列化：SchemaNode → JSON 字符串（{ version: 1, root: ... } 信封）
const json = serializeSchema(schemaNode)

// 反序列化：JSON 字符串 → SchemaDocument
const doc = parseSchema(json)
```

**host-only 值摘除**：序列化时，函数、Symbol、BigInt、RegExp 等 JSON 无法承载的值会被从输出中**摘除**，并以原路径（`$.props.foo`）记录在与原节点关联的宿主侧表中，不进入 JSON（该表目前为 codec 内部机制，未从包入口导出）。反序列化后的文档中这些位置为空。

**parseSchema 的兼容策略**：输入若含 `version` + `root` 则按信封解析（识别 `schemaVersion`/`id`/`initialState`/`materials`/`materialVersions`/`extensions`）；否则视为 v0 裸节点，包装为 `{ version: 0, root }`。解析时会向 `diagnosticSink` 发出 `SCHEMA_LOAD` 诊断。

## 版本迁移（migrations）

```typescript
import {
  migrateToV1, rollbackToV0, migrateIdempotent, describeDocument, wrapLegacy
} from '@variojs/schema'

// 任意输入（v0 裸节点 / v1 文档）→ 统一升到 v1 信封
const doc = migrateToV1(anyInput)

// v1 → v0（仅保留 root + materials，用于回滚旧版本消费方）
const legacy = rollbackToV0(doc)

// 幂等性验证：二次迁移结果一致（用于测试与审计）
migrateIdempotent(doc)

// 文档摘要诊断：版本、id、物料及版本清单
const info = describeDocument(doc)
// → { code: 'DOCUMENT_VERSION', message: 'SchemaDocument version 1',
//     phase: 'migrate', metadata: { version, schemaVersion, id, materials, materialVersions } }

// 面向加载入口的组合 API：迁移 + 发出 SCHEMA_MIGRATE 诊断
const loaded = wrapLegacy(anyInput, { diagnosticSink })
```

`migrateToV1` 的补全规则：`id` 缺省取 `root.id`（再回退 `'doc:root'`）；`materialVersions` 缺省时从 `materials` 列表推导（键为 `type ?? name`）。

## 物料清单（MaterialManifest）

物料清单声明文档依赖的外部组件（物料），供编辑器、版本治理与增量升级使用：

```typescript
import { validateMaterialManifest } from '@variojs/schema'
import type { MaterialManifest } from '@variojs/types'

const manifest: MaterialManifest = {
  name: 'ElTable',          // 物料名（或用 type 字段）
  type: 'ElTable',          // 可选：与 schema 节点 type 对应的标识
  version: '2.5.0',         // 必填
  props: { data: 'array' }, // 可选：props 描述
  events: ['select'],       // 可选：对外事件
  slots: ['default'],       // 可选：插槽
  models: ['checked'],      // 可选：具名 model（model:xxx）
  capabilities: ['virtual'] // 可选：能力声明
}

const { valid, errors } = validateMaterialManifest(manifest)
// errors: [{ field: 'version', message: 'version is required' }, ...]
```

校验规则：`name`/`type` 至少一个必填；`version` 必填字符串；`props` 必须对象；`events`/`slots`/`models` 为字符串数组或对象；`capabilities` 为字符串数组。

## 与 useVario / defineSchema 的关系

- **defineSchema** 返回的 **VarioView** 新增 `document` 字段，可挂载 SchemaDocument 元数据随视图一起分发。
- 渲染层消费的是 `doc.root`（即普通 SchemaNode），信封字段由宿主（编辑器、CLI、服务端）解释。
- 推荐管线：`parseSchema` / `wrapLegacy`（装载与迁移）→ `validateSchema`（校验 root）→ `normalizeSchema`（规范化）→ 渲染。

## 相关文档

- [验证](/packages/schema/validation)：装载后对 `root` 做结构校验
- [规范化](/packages/schema/normalization)：渲染前统一格式
- [API 参考](/packages/schema/api)：完整导出清单
