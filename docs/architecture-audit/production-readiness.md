# 生产适用性与风险清单

> 当前结论：**Not Ready for Production Core**（2026-08-31 审计时点）  
> 最终解除条件：完成 [实施路线图 Phase 0～4](./implementation-roadmap.md) 并达到 [G6 Production Core 验收档](./acceptance-gates.md#准入档与门禁归属)。更低档能力可按各自门禁分阶段准入，不等于整个低代码核心已就绪。

> ## 更新记录（2026-09-01）
>
> 路线图 Phase 0～5 已实施完成并通过库级验收（core 305 / schema 100 / vue 532 / cli 14 / consumer 10；lint 0/0；五包 tsc 全过；Chrome baseline JSON 齐全；`spec.md` 22 条 AC 与 51 项任务全部勾选）。本页风险表逐项关闭，映射如下：
>
> - **P0 全部关闭**：R-001（ScopeFrame）、R-002（StateBridge 单调度源）、R-003（固定 LifecycleBoundary）、R-004（contract matrix）、R-005（path-policy own-only + 保留段）、R-006（单一 policy + fingerprint）、R-007（ExecutionSession 共享 deadline/steps/signal）、R-008（batch journal commit/rollback）、R-009（CanvasWorkspace revision/patch）、R-010（固定 ErrorBoundary/onErrorCaptured）、R-011（CLI bin smoke + programmatic result）、R-012（CI test/lint gate）。
> - **P1 全部关闭**：R-101（prepare 单次 index ≤3N）、R-102（LoopRegion/Cell 单 cell 更新）、R-103（dynamic props plan）、R-104（prepared 无 root deep watch）、R-105（ExpressionPlan + result memo，101 断崖消除）、R-106（ScopeFrame 替代 loop pool）、R-107（VirtualListAdapter + reference，DOM≤200）、R-108（Engine/Session scoped registry）、R-109（SchemaDocument v1 + migration）、R-110（MaterialManifest）、R-111（迭代 query/traversal）、R-112（`@variojs/core/runtime` 子出口 0.6KB gzip）、R-113（DiagnosticSink + metrics）、R-114（包依赖 DAG 已核）。
> - **P2 状态**：R-201/R-202/R-203/R-204 已关闭（event-modifiers 矩阵、session ref registry、SSR matrix、action union）；R-205 部分关闭（evaluator/renderer 已按 plan/policy/runtime 分解，上帝模块治理持续进行）。
> - **默认 runtime**：代码与文档已对齐为 **`legacy`**（prepared 显式 opt-in），与下方审计时点描述相反处以后者为准。
> - 剩余仓库外评审项：PERF-D4 真实应用 RUM、生产 SSR 集群、真实画布宿主与真实物料库适配。详见 [专项验收报告](./vue3-deep-runtime/verification-report.md)。

## 1. 场景判断

### 1.1 小型 Vue 页面

在 Schema 可信、节点少、更新频率低、没有复杂 loop/lifecycle/deep dynamic props 时，当前设计的心智模型是可用的：`useVario` 调用紧凑，Core 与 Vue 基本分层，简单表达式和路径热访问足够快。

但当前工作树已有 loop 回归和安全阻断，因此即使小页面也应先完成 Phase 0 再发布。

### 1.2 中型业务页面

200～1000 节点的表单、仪表盘在 **prepared（显式启用）** 下走区域更新，库级门禁已通过（2026-09-01）：

- 默认 `getRuntimeMode() === 'legacy'`；`runtimeMode:'prepared'` 或 `setRuntimeMode('prepared')` 启用区域渲染，`legacy` 随时可回滚。
- 库级 G6 Production Core 已授予；真实应用 RUM（PERF-D4）仍需应用侧评审。

### 1.3 中大型低代码画布

库级画布能力已落地（CanvasWorkspace revision/patch、CANVAS-1～5 单测通过），但真实画布宿主 RUM 仍需仓库外评审：

- 默认 runtime 为 `legacy`，prepared 仅 `setRuntimeMode('prepared')` 或 `runtimeMode:'prepared'`。
- 深层 Schema 原位修改走 CanvasWorkspace revision/patch；预览刷新已由库级 patch 通道覆盖。
- 不可信物料在未开 `materialMode: 'strict'` 时仍按字符串标签 fallback。

### 1.4 多页面运行时

20 页 × 200 个简单节点可以在实验机挂载，但缺少生产所需的资源治理：

- 每页可有独立 PageSession/Engine materials；公开 loop pool 为不保留 locals 的 shim。
- PageSession 有 pause/resume/dispose；PageSessionManager 有 LRU eviction。
- 隐藏页面 inactive 时不接收 ChangeSet；未完成真实多页生产流量与绝对零 heap 增长证明。

### 1.5 不可信 Schema

库级安全边界已建立（SEC-1～SEC-8 测试/fuzz 全过：路径原型污染阻断、系统路径覆盖阻断、表达式只读 + capability registry、path/cache 预算与 LRU），但**租户 Schema 的生产准入仍需环境评审**（不可信物料按 `materialMode: 'strict'/'untrusted'` 阻断，表达式原生长调用需 Worker/服务端隔离）。即使输入来自”内部运营”，也应按不可信配置处理，因为误配置与攻击的结果相同。

## 2. 风险总表

| ID | 等级 | 模块 | 风险 | 主要证据 | 目标动作 |
|---|:---:|---|---|---|---|
| R-001 | P0 | Core/Vue loop | `itemKey/indexKey` 别名求值为 undefined | compiler `:106-143`；core loop test 失败；浏览器文本为空 | 显式 lexical ScopeFrame |
| R-002 | P0 | Vue state | `ctx._set` 后下一次直接 state 写可能不刷新 | phases `:113-116,250-268` | 删除 skipOnce 双通道 |
| R-003 | P0 | Vue lifecycle | 普通更新导致 unmount+mount | lifecycle-wrapper `:43-73`；mounted=2/unmounted=1 | 稳定 Boundary 组件 |
| R-004 | P0 | Schema contract | 类型、validator、normalizer、runtime 不一致 | types schema `:351-366`；validator `:141-159`；normalizer `:39-114` | 单一 discriminated contract |
| R-005 | P0 | Path security | action 可原型污染或覆盖 `$emit/$methods` | path `:243-313`；create-context `:80-93` | SafePathPlan + reserved segments |
| R-006 | P0 | Expression security | 表达式可 mutation，policy cache 可越权复用 | evaluator `:43-76,586-606`；cache `:97-115` | 单一纯函数能力策略 + policy key |
| R-007 | P0 | Action VM | 嵌套重置 maxSteps/timeout；超时后仍写 state | executor `:38-46,201-213`；if/loop/batch 子 execute | ExecutionSession + cancellation |
| R-008 | P0 | Batch | 注释称原子，实际部分提交且继续执行 | batch `:1-57` | 明确 transaction 或改语义并迁移 |
| R-009 | P0 | Canvas | Schema 深改不刷新，query patch 静默 no-op | phases `:240-242`；composable `:127-129` | 结构共享 patch + revision |
| R-010 | P0 | Error | errorBoundary 捕不到后代 Vue render/setup 错误 | phases `:181-228` | `onErrorCaptured` 稳定边界 |
| R-011 | P0 | CLI | 发布 bin 无输出，多页面 codegen 覆盖 | bin `:2`；cli index `:63-65`；codegen 固定文件 | bin smoke + page-scoped output |
| R-012 | P0 | Release | 当前测试/lint 失败但构建仍可发布 | unit/lint 实测；CI 无 test gate | 发布前强制 clean build+gates |
| R-101 | P1 | Vue render | parentMap 平铺 O(N²) | renderer `:274-285`；1000 节点 1,003,003 set | prepare 阶段单次 index |
| R-102 | P1 | Vue loop | 单项更新重渲染全部 cell | loop-handler `:112-168`；1000/1000 render | 稳定 LoopRegion/Cell |
| R-103 | P1 | Vue attrs | 深层动态 props 被永久静态缓存 | attrs-builder `:88-117,178-239` | compile-time deep dependency scan |
| R-104 | P1 | Vue state | deep sync watch + 根 VNode 重建 | phases `:250-268` | Vue 原生节点级依赖跟踪 |
| R-105 | P1 | Cache | 100→101 表达式 16.8～24倍 cliff | cache `:26-33,71-88` | ExpressionPlan + version memo |
| R-106 | P1 | Loop memory | 伪对象池 O(L×K) 且保留 parent context | loop-context-pool `:36-55,96-124` | 删除池或 scoped frame pool |
| R-107 | P1 | Lists | 无虚拟化，loop 创建全部 DOM | loop-handler `:112-186` | 可插拔 virtual adapter |
| R-108 | P1 | Multi-page | model config/defaultPlugins 是全局可变状态 | bindings `:30-34`；plugins index `:29-34` | Engine/Session scoped registry |
| R-109 | P1 | Schema evolution | 无 schemaVersion/document/materialVersions/migrations | types schema root definition | SchemaDocument v1 + migration |
| R-110 | P1 | Materials | 组件 registry 没有 props/events/slots/capability/version 契约 | Vue options components `Record<string, any>` | MaterialManifest + validator |
| R-111 | P1 | Query | findNode 非 first、root id 失败、无 index 不 fallback | traversal/analyzer/query-engine | 迭代遍历 + 明确 ID 语义 |
| R-112 | P1 | Bundle | 仅导 path 仍带 Babel parser，约79.6KB gzip | parser 同步 import；esbuild probe | 子入口 + CLI/Worker precompile |
| R-113 | P1 | Observability | 无统一 diagnostic/metrics/trace sink | log action console；errors 暴露 context | no-op telemetry ports |
| R-114 | P1 | Package graph | manifest 人为制造 core↔schema 循环 | core/schema package.json | 删除 core→schema |
| R-201 | P2 | Events | capture/passive 元数据无人消费，修饰符不完整 | event-handler `:174-295` | 编译事件描述并用 Vue helpers |
| R-202 | P2 | Refs | 动态 ref 只增不减，loop 无 ref_for | refs `:61-121` | ref lifecycle registry |
| R-203 | P2 | SSR | 无 request isolation/hydration/teleport 契约测试 | Vitest Node environment | SSR matrix + per-request engine |
| R-204 | P2 | Types | `Action {type:string}` 与 Schema 任意 key 抵消类型安全 | types action/schema | 内建 union + namespaced extension |
| R-205 | P2 | Maintainability | evaluator/renderer/validator 是上帝模块 | 711/556/482 行 | 按 policy/plan/runtime 分解 |

路径简写均相对于仓库根，如 `compiler` 指 `packages/vario-core/src/expression/compiler.ts`。

## 3. P0 详细说明

### R-001：循环作用域不是一等概念

当前 loop/scoped slot 依赖 JavaScript prototype 临时挂变量，compiler 却假设所有简单标识符都是 StateStore path。修补某一个别名不能解决嵌套 loop、slot、event 与 async action 的作用域串扰。

目标是显式 ScopeFrame：

```typescript
interface ScopeFrame {
  readonly parent?: ScopeFrame
  readonly values: Readonly<Record<string, unknown>>
  readonly generation: number
}
```

表达式读取顺序必须固定为 `local scope → system scope → state → approved globals`。

### R-002：Vue 与 Core 同时负责调度

当前既让 Vue reactive 深 watch，又让 RuntimeContext onStateChange 主动 schedule，形成重复信号和先后时序 bug。Vue renderer 中应由 Vue 成为唯一 UI 更新调度源；Core 只发布标准 StateStore change，不保存“下一次 watch 跳过”这种框架时序状态。

### R-003：动态创建组件类型

`defineComponent()` 发生在 render 热路径，Vue 每次看到新 type 都必须卸载旧子树。除了 lifecycle 重复，它还会丢失输入焦点、局部 ref、弹窗状态、第三方组件实例与 KeepAlive 语义。

使用固定 `VarioLifecycleBoundary`，schema/nodeId/runtime 作为稳定 props；lifecycle 名称变化由 props 驱动，而不是创建新组件类。

### R-004：Schema 不是一个契约

低代码平台必须只有一个 Schema 真相源：

- TypeScript union 负责开发期。
- Runtime codec/validator 负责不可信输入。
- normalizer 只能结构保留，不能改变业务值。
- compiler 消费 validator 输出，不再重复猜测语法。
- CLI 从同一 codec 生成类型与 diagnostics。

当前 `SchemaNode[key:string]:unknown` 应收敛为 `extensions?: Record<namespace, JsonValue>`；legacy 任意字段由迁移器保留。

### R-005/R-006：安全边界不成立

至少需要：

- 路径段禁止 `__proto__/constructor/prototype/$*/_*`，只访问 own property。
- 限制 path 长度、段数、数组 index，禁止 while 补齐超大数组。
- 表达式能力精确到方法，不能按 `Object.*` 根对象放行。
- 表达式只读；删除 `reverse/sort/Object.assign/setPrototypeOf/defineProperty`。
- 只有显式 capability registry 可调用 `$functions/$utils`，并标记 pure/cost/input limit。
- cache key 包含 policy fingerprint；有时间、随机、事件或 capability 的表达式不缓存结果。
- 对真正不可信且计算量不可控的表达式，使用 Worker/服务端隔离；同步 JS timeout 无法抢占原生长调用。

### R-007/R-008：VM 缺少执行会话

一个用户事件必须对应一个共享的 executionId/deadline/steps/signal/call stack。所有内建 control-flow 调用内部 `runChild`，不能重新进入公开 `execute`。

`batch` 必须做出唯一选择：

- 若保持“原子”承诺：写入 journal，全部成功再 commit，失败 rollback。
- 若不提供事务：重命名内部语义为 settled sequence，并对 legacy `batch` 给出迁移告警。

不允许继续保留“注释原子、实现部分提交”。

### R-009：画布写路径

保持 `findById(...).patch(...)` 外观，内部实现：

```text
patch(nodeId, partial)
  -> validate patch against MaterialManifest
  -> structural-share update
  -> schemaRevision++
  -> incremental recompile affected node/subtree
  -> emit reversible patch record
```

现有裸 Schema 仍能传给 useVario；没有显式 id 时由 legacy adapter 生成 path-based 临时 id，并在开发态提示画布应持久化 stable id。

### R-010：真实 Vue 错误边界

外层 try/catch 只能捕获 VNode 构造错误。必须有固定组件调用 `onErrorCaptured`，并把 schemaId/pageId/nodeId/phase 传给 diagnostic sink。子节点错误不能继续静默返回 null。

## 4. P1 对中大型项目的直接影响

### 协作与变更半径

当前模块表面拆分较细，但核心语义散落在两套渲染管线、两套表达式白名单、四条状态写通道。新增一个 feature 往往需要同时改 types/validator/normalizer/renderer/tests，且没有 contract fixture 保护，属于高散弹式修改风险。

### 主线程预算

画布拖拽通常每秒 30～60 次变化。当前任何一次变化都可能触发 deep watch、缓存扫描、全树 VNode 重建和 Vue patch。即使单次 1000 原生节点为 8.8ms，也没有给拖拽逻辑、组件库、布局和浏览器 paint 留足预算。

### 多团队物料

只有组件名到 `any` 的映射，无法阻止团队 A 修改 props 语义后破坏团队 B 的历史页面。必须把物料版本、props、events、slots、model、capability 与 migration 作为正式 manifest。

### 多页面与微前端

模块全局 registry 会让实例之间发生最后写入者获胜。PageSession 必须持有自己的 material/action/model/plugin/cache/effect scope，并有明确 dispose。

## 5. 当前可接受的临时规避

在 Phase 0 完成前不建议发布。若仅用于内部原型：

- 只接受版本库内、代码评审过的 Schema。
- 不使用 `itemKey/indexKey` 别名，当前可临时用 `$item/$index`，但这不是正式修复。
- 不使用 lifecycle/provide/inject 节点承载有本地状态的组件。
- Schema 变更必须替换根引用，不做深层原位 mutation。
- 唯一表达式控制在 ≤80，loop 控制在 ≤100 行。
- 不让页面同时驻留；离开页面即卸载。
- 不依赖 `batch` 原子性、query patch、errorBoundary 或 CLI bin。

这些规避只能用于验证产品，不构成生产批准。

## 6. 生产批准条件

| 阶段 | 批准范围 |
|---|---|
| Phase 0 + G1 全过 | 恢复小型可信 Schema 页面发布 |
| Phase 1 + G2 全过 | 只开放 prepared runtime canary 与 `SchemaDocument v1` 试点 |
| Phase 2 + G3 全过 | 开放中大型 Vue 页面与大列表试点 |
| Phase 3 + G4/G5 分别全过 | 分别开放画布或多页面；不互相借用验收结果 |
| Phase 4 + G6 全过 | 才能评估第三方/租户 Schema、SSR 与 Production Core 正式支持 |
