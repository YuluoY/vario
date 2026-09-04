# 可执行实施路线图

> 原则：先正确、再局部化、最后扩规模。每个阶段独立可发布、可灰度、可回滚；禁止在没有安全网时同时重写 Schema、Core VM 和 Vue renderer。

## 总览

| 阶段 | 目标 | 参考工程量 | 可批准场景 | 实施状态 |
|---|---|---:|---|---|
| Phase 0 | 修复生产阻断与发布事实链 | 15～20 人日 | 小型可信 Schema 页面 | ✅ 已完成（2026-09-01） |
| Phase 1 | 建立 Schema prepare、StateStore、Session 内核 | 15～25 人日 | prepared canary / SchemaDocument v1 试点 | ✅ 已完成 |
| Phase 2 | Vue 节点级更新、稳定 loop、虚拟化接口 | 20～30 人日 | 中大型 Vue 页面/列表试点 | ✅ 已完成 |
| Phase 3 | 画布 patch、多页面、物料与迁移 | 20～30 人日 | 低代码画布与多页面试点 | ✅ 已完成 |
| Phase 4 | 安全隔离、SSR、可观测与发布硬化 | 10～20 人日 | 评估正式生产/租户 Schema | ✅ 已完成 |

工程量只用于拆分优先级，不是排期承诺；应以每阶段门禁通过为完成定义。全部阶段已实施并通过库级验收（详见 [专项验收报告](./vue3-deep-runtime/verification-report.md)）；prepared 保持显式 opt-in，默认 runtime 为 `legacy`，符合"prepared 成为默认"位于灰度最后一步的纪律。租户 Schema 与生产 SSR 集群仍属仓库外环境评审项。

与 `@variojs/vue` 深层更新相关的实现已进一步拆为 [6 个 Phase、51 个任务](./vue3-deep-runtime/tasks/README.md)，每项 2～4h。总路线图仍负责跨包准入；专项任务负责具体文件、依赖和断言，二者不得各自改变实施顺序。

## 分级准入与门禁归属

门禁不再“一刀切阻止任何阶段发布”；它只阻止下表对应的能力准入。只有最终 `Production Core` 准入要求 [验收门禁](./acceptance-gates.md) 全部通过。

| 准入档 | 实施阶段 | 必须通过的门禁组 | 不授权的能力 |
|---|---|---|---|
| G1 小型可信页 | Phase 0 | COMP-2/3/5/6、CONTRACT-1～4、SEC-1～7、STATE-1～4、EXPR-1～4、VM-1～7、VUE-1～6、RELEASE-1～6 | 画布、多驻留页、prepared runtime、版本迁移、高级 event modifier/lazy model/loop ref、租户 Schema、SSR |
| G2 prepared canary | Phase 1 | G1 + COMP-1/4、CONTRACT-5/7、PERF-A1/A4/A5/A6、BUNDLE-1～5、RELEASE-7 | 默认切流、大列表、画布 |
| G3 中大型 Vue 页 | Phase 2 | G2 + VUE-7～9、PERF-A2/A3、PERF-T1～6、PERF-D1/D2、MEM-1/2、Vue 真实组件 fixture | 画布、多页面资源治理、租户 Schema |
| G4 画布 | Phase 3 | G3 + CONTRACT-6/7、CANVAS-1～5、PERF-D3 | 租户 Schema、SSR |
| G5 多页面 | Phase 3 | G3 + LIFE-1～5、PERF-T7/T8、MEM-3/4 | 租户 Schema、SSR |
| G6 Production Core | Phase 4 | 全部 COMP/CONTRACT/SEC/STATE/EXPR/VM/VUE/CANVAS/LIFE/PERF/MEM/BUNDLE/OBS/RELEASE | 无；租户 Schema 与 SSR 仍需各自环境评审 |

## Phase 0：生产阻断修复

### 0.1 先建立特征测试

**目标**：把当前公开语法与已发现回归转成失败即阻断的测试，再改实现。

**新增/调整**：

```text
packages/vario-core/__tests__/security/
  path-pollution.test.ts
  expression-purity.test.ts
  policy-cache.test.ts
packages/vario-core/__tests__/vm/
  execution-budget.test.ts
  cancellation.test.ts
  batch-atomicity.test.ts
  lexical-scope.test.ts
packages/vario-schema/__tests__/
  contract-matrix.test.ts
  normalization-golden.test.ts
packages/vario-vue/__tests__/browser/
  state-update.test.ts
  loop-scope.test.ts
  lifecycle-boundary.test.ts
  error-boundary.test.ts
  canvas-patch.test.ts
tests/consumer/
  public-api/
  package-install/
  cli-bin/
```

**必须覆盖**：

- EventHandler 五种合法形式通过同一 contract fixture。
- 所有内建 Action payload 的合法/非法表。
- loop alias 与 `$item/$index`。
- `ctx._set` 后立即 `state.x=`。
- lifecycle 不因普通 update 重挂。
- descendant render error 进入 fallback/onError。
- query patch 不能 no-op。
- 从所有 `src/index.ts`、`package.json#exports`、d.ts 和当前 tarball 生成公共值/类型导出清单、签名 snapshot 与 import smoke。
- 为 `clearNormalizationCache`、`createLoopContext/releaseLoopContext`、`defaultPlugins`、unknown component fallback 和 `useVario` 全部返回字段建立 characterization fixture。
- 建立“安全收紧/明确 bug”兼容例外清单；其他 API/behavior diff 一律阻断。

### 0.2 Path 与 State 写入安全

**现有锚点**：

- `packages/vario-core/src/runtime/path.ts`
- `packages/vario-core/src/runtime/create-context.ts`
- `packages/vario-core/src/runtime/proxy.ts`
- `packages/vario-core/src/vm/handlers/array/*`

**任务**：

1. 新建 `runtime/path-policy.ts`，集中保留段、最大长度、最大深度、最大数组 index。
2. `get/set` 只访问 own property；中间字典使用 `Object.create(null)`。
3. `_set` 检查 `setPathValue` 结果，失败抛 `PathWriteError`，不发成功回调。
4. 禁止 `_set('$emit')`、`_set('$methods.*')`、`_set('_get')`。
5. 数组 action 改为 `StateStore.mutate` 或至少统一 `_set` 通知，不再原地写后手工失效。
6. `parsePathCached` 返回冻结计划/只读副本，避免调用方污染 cache。
7. 将 1999/2000/2001 边界写入回归；不允许 path cache 到点全清引起周期性冷启动（SEC-4）。

**验收**：SEC-1～SEC-4、STATE-1～STATE-4。

### 0.3 Expression 安全与正确性止血

**现有锚点**：

- `expression/whitelist.ts`
- `expression/evaluator.ts`
- `expression/cache.ts`
- `expression/compiler.ts`

**任务**：

1. 抽出单一 `expression/policy.ts`，validator/evaluator 共用精确方法表。
2. 删除原数组 `reverse/sort`，禁止 `Object.assign/setPrototypeOf/defineProperty`。
3. 仅允许注册的 `$functions/$utils` capability；禁止任意 `$*` 方法。
4. cache key 加 `policyFingerprint`；使用独立 hit/miss sentinel。
5. 非纯表达式禁用结果 cache。
6. 临时修复 loop/slot alias：在完整 ScopeFrame 落地前，compiled accessor 必须先解析 local binding，不能直接假定 StateStore path。
7. 给被拒的历史表达式生成带 node path 的 migration diagnostic。

**回滚**：保留旧 policy 仅用于受信 legacy 文档的显式兼容模式；默认安全模式不可回滚到宽泛白名单。

### 0.4 VM ExecutionSession

**现有锚点**：`vm/executor.ts` 与 `vm/handlers/{if,loop,batch,call}.ts`。

**任务**：

1. 新建内部 `vm/execution-session.ts`。
2. `execute()` 只创建一次 session；handlers 使用内部 `runChild`。
3. 嵌套共享 absolute deadline、remainingSteps、signal。
4. await 前后和 commit 前检查 cancellation。
5. custom method additive 接收 execution metadata；旧 handler 仍可二参数调用。
6. `batch` 引入 mutation journal 并做 commit/rollback。
7. `BatchError` 不再被二次包装成通用 ActionError。
8. loop 在每个 item/body/native capability 上消耗同一 budget；按配额分批 yield，取消后不再进入下一批（VM-7）。

**验收**：VM-1～VM-7。

### 0.5 Schema 契约统一

**现有锚点**：

- `packages/vario-types/src/{schema,action}.ts`
- `packages/vario-schema/src/{validator,normalizer,transform}.ts`

**任务**：

1. 为内建 action 建 discriminated union 与 runtime validator table。
2. EventHandler 五种形式先 normalize 为 ActionPlan，再验证 payload。
3. normalizer 改为“复制全部字段，再规范化 known fields”，不删除业务空字符串/null。
4. 完整保留 model default/lazy/modifiers、id、Vue fields、namespaced extension。
5. `clearNormalizationCache` 真正清理；内核后续改为 revision cache 时仍保留 deprecated shim，不在兼容版本线删除。
6. defineSchema golden fixture 验证 `input → normalize → render/query` 语义不丢。

**验收**：CONTRACT-1～CONTRACT-4；CONTRACT-5 需要 v1 codec/migration/prepare，归 Phase 1。

### 0.6 Vue 正确性

**现有锚点**：

- `composables/internal/use-vario-phases.ts`
- `features/lifecycle-wrapper.ts`
- `features/attrs-builder.ts`
- `features/vario-node.ts`
- `features/children-resolver.ts`
- `features/loop-handler.ts`

**任务**：

1. 删除 `skipReactiveWatchOnce` 时序协议；Vue adapter 写只走一个调度源。
2. lifecycle/provide/inject 改固定 Boundary type。
3. 引入真实 `onErrorCaptured` 边界；停止静默吞子节点错误。
4. 深度扫描动态 props；在 compile architecture 前至少修正永久静态缓存。
5. 合并 VarioNode 与 Renderer 的 directives/ref/plugin 后处理函数。
6. `NodeWrapper.patch` 对 writable schema 做结构共享更新；只读 schema 抛明确错误或调用 `onSchemaPatch`。
7. 明确 Schema 更新 contract：Phase 0 先恢复正确性，Phase 1 后默认结构共享根 revision。
8. 修正 query 语义：root ID 可查、`findNode` 全局 first-match 停止、无 index 时正确 fallback，duplicate ID 在 validator 阻断（R-111）。

**验收**：VUE-1～VUE-6。CANVAS-1 在此提前修复 query patch no-op，但不构成 G4 画布准入；VUE-7～VUE-9 归 Phase 2。

### 0.7 CLI、包与发布

**任务**：

1. bin 显式调用导出的 `runCli(process.argv)`，增加 `--help/--version` smoke。
2. programmatic API 不调用 `process.exit`，返回 typed result/error。
3. codegen 按输入相对路径/pageId 输出，先 validate，排序文件列表。
4. 删除 core→schema 与 CLI→core/vue 虚假依赖。
5. Vue 写入 peerDependencies，停止 publish 时临时修改 manifest。
6. publish 永远 clean build，校验 git/worktree 与 dist hash。
7. CI 顺序：lint → tsc → unit → source integration → browser → pack-install → build → publish dry-run。
8. API Extractor/d.ts snapshot、公共 value export smoke 和安全合法行为 fixture 从 Phase 0 开始阻断，不延后到 Phase 4。
9. CLI 版本从 `package.json` 读取；定义 workspace 发布单元、包版本与 git tag 的唯一对应，从 Phase 0 开始使用 changeset/release manifest。
10. 将本次 Core/security/bundle/browser 探针固化为脚本并保存 JSON 原始结果、runner ID、Node/Chrome/Vue 版本与执行模式。

**验收**：COMP-2/3/5/6、RELEASE-1～RELEASE-6。RELEASE-7 含 migration/bundle/performance profile，在 Phase 1 的 G2 门禁验收。

## Phase 1：PreparedView 与 RuntimeSession

### 1.1 SchemaDocument 与 migration

**新增模块**：

```text
packages/vario-types/src/document.ts
packages/vario-types/src/material.ts
packages/vario-schema/src/codec/
packages/vario-schema/src/migrations/
```

**任务**：

- 裸 Schema 自动包装 legacy v0 并迁移到 `SchemaDocument v1`。
- v1 codec 只接受 JSON-safe 值；RegExp/function 等进入 host-only extension，不进入持久化文档。
- migration 每步纯函数、幂等、带 golden snapshots。
- document/material versions 进入 diagnostics。

### 1.2 Prepare compiler

**新增模块**：

```text
packages/vario-schema/src/compiler/
  prepare-view.ts
  prepare-node.ts
  prepare-expression.ts
  prepare-action.ts
  prepare-index.ts
```

**任务**：

- 迭代式 O(N) 遍历，单次建 parent/children/id/path index。
- compile dynamic props/text/cond/show/model/events。
- 生成 stable PreparedNode，不保存可变 Schema 引用。
- duplicate id、invalid extension 形成阻断 diagnostic；unknown material 只在 strict/untrusted 模式阻断，legacy/默认兼容模式继续字符串标签 fallback 并发迁移警告。
- WeakMap 按 root + revision 缓存 PreparedView。

细颗粒任务：[Phase 1 Prepared 与依赖](./vue3-deep-runtime/tasks/phase1-prepared-and-dependencies.md)。这里的 10,000 层要求只验证迭代 compiler 可受控处理，不代表 Vue DOM 支持该深度。

### 1.3 StateStore 与 ScopeFrame

**新增模块**：

```text
packages/vario-core/src/state/
packages/vario-core/src/scope/
packages/vario-core/src/runtime/runtime-session.ts
```

- 统一 write/mutate/batch/version/subscribe。
- event/loop/slot 使用不可变 ScopeFrame，不再 Object.create RuntimeContext。
- 删除当前内部全局 loop pool；已公开的 `createLoopContext/releaseLoopContext` 保留 deprecated shim 并委托 ScopeFrame。若后续基准证明需要，再实现真正 session-scoped frame pool。
- Session dispose 清 cache、subscription、running execution。

### 1.4 ExpressionPlan cache

- AST/plan 跨 Session 共享，结果 memo 属于 Session。
- Map 顺序或专用 LRU O(1) 淘汰，按字节/plan 数可配置。
- 公开 cache stats：hit/miss/evict/bytes，不暴露表达式原文。
- 增加 99/100/101/500/2000+ 门禁。

ExpressionPlan 必须先提供 state/local dependency 与版本 memo，随后 Phase 2 才能移除 prepared mode 的根 deep watch。

### 1.5 包出口与 bundle 分层

**现有锚点**：`packages/*/package.json`、`packages/*/tsup.config.ts`、`packages/vario-core/src/index.ts`。

- 新增 `@variojs/core/runtime`、`./expression`、`./vm`、`./schema-tools` 等子出口，根出口继续兼容重导出。
- 拆分 tsup entry/chunk，让 runtime/path/state 子出口不同步 import Babel parser。
- expression compiler 只在运行时动态编译时 lazy load；CLI/prepared plan 场景不进主 chunk。
- 为每个子出口建空 consumer + esbuild metafile/minified/gzip probe，执行 BUNDLE-1～BUNDLE-5。
- 根出口与子出口的值/类型 snapshot 同时通过，新增子出口不能破坏 COMP-6。

### Phase 1 灰度

在内部增加 runtime mode，不要求调用方改 `useVario`：

```text
legacy renderer (fallback)
prepared renderer (candidate)
dev shadow prepare + diagnostics compare
```

灰度时比较 DOM snapshot、events、state changes 和 diagnostics，不比较 VNode 对象身份。

**Phase 1 验收**：COMP-1/4、CONTRACT-5/7、PERF-A1/A4/A5/A6、BUNDLE-1～BUNDLE-5、RELEASE-7；全部通过才能进入 G2 prepared canary。

## Phase 2：Vue 节点级渲染

### 2.1 稳定组件图

```text
packages/vario-vue/src/components/
  VarioRoot.ts
  VarioNode.ts
  VarioLoopRegion.ts
  VarioLoopItemCell.ts
  VarioErrorBoundary.ts
  VarioLifecycleBoundary.ts
```

组件职责：

| 组件 | 单一职责 | 稳定 props |
|---|---|---|
| VarioRoot | 绑定 PreparedView 与 PageSession | sessionId/rootNodeId |
| VarioNode | 渲染一个 PreparedNode | runtime/nodeId |
| LoopRegion | 维护 key→cell 集合 | runtime/nodeId |
| LoopItemCell | 持有 item ScopeFrame | runtime/templateId/itemKey |
| ErrorBoundary | 捕获 descendant Vue error | runtime/nodeId |
| LifecycleBoundary | 注册固定 lifecycle | runtime/nodeId |

禁止 render 内 defineComponent，禁止把每轮新建数组/对象/闭包当边界 props。

组件图是动态区域图，不是 Schema 逐节点镜像；静态骨架不得产生近似 `N` 个内部组件。细颗粒任务：[Phase 2 Vue 稳定区域](./vue3-deep-runtime/tasks/phase2-vue-stable-regions.md)。

### 2.2 移除根 deep watch

- StateStore/Vue reactive 值在 Node render/computed 中被真实读取。
- 根 VNode 只在 PreparedView revision 改变时替换。
- 单个 state leaf 更新的 render count 应等于受影响节点 + 必要祖先，而不是 N。
- Schema analyzer 不再另建 deep watcher，stats 来自 PreparedView。

硬前置：Proxy/VM/array/model/namespace/batch 全部产生 ChangeSet，ExpressionPlan 使用 dependency versions，shadow fixture 无陈旧结果。任一未满足时不得执行本节。

### 2.3 Loop 与虚拟化

- Cell 不 clone Schema，不重建 handler/path stack。
- item key 与 alias 分离。
- 100/500/1000 行更新 render count 分别保持 1 cell。
- 定义 `VirtualListAdapter`，由宿主提供 viewport/estimateSize/overscan/a11y 策略。
- 提供一个仓库内 reference adapter 与固定高度/可变高度测试宿主，PERF-T5/T6 不得只对接口本身验收。
- 超过阈值未配置 virtual 时开发态 diagnostic，不偷偷改变 DOM 语义。

ScopeFrame、LoopRegion/Cell、SlotRegion、展开预算和 reference adapter 的逐文件任务见 [Phase 3 Loop/Slot Runtime](./vue3-deep-runtime/tasks/phase3-loop-slot-runtime.md)。

### 2.4 Model/ref/event

- model default 在 Session 初始化一次应用，禁止 render 内 `_set`。
- lazy 不为每次 render/字段创建 timer。
- event modifier 使用 Vue 标准 helpers/明确实现矩阵。
- event ScopeFrame 每次触发独立，不改共享 ctx.$event/$parent。
- ref registry 处理 mount/update/unmount 与 loop arrays。

**Phase 2 验收**：VUE-7～VUE-9、PERF-A2/A3、PERF-T1～T6、PERF-D1/D2、MEM-1/2；全部通过才能进入 G3，画布拖拽 PERF-D3 不属于本阶段。

## Phase 3：画布、多页面与物料生态

### 3.1 Canvas command/patch

```text
packages/vario-schema/src/patch/
packages/vario-schema/src/compiler/incremental/
```

- Patch 以 nodeId 定位，包含 before/after/revision。
- apply 返回新 document 与受影响 nodeIds。
- 支持 undo/redo、冲突检测、审计。
- compile 只更新受影响 PreparedNode/Plan/index。
- 5000 节点画布编译放 Worker，主线程只应用 plan delta。

### 3.2 PageSessionManager

```text
packages/vario-core/src/runtime/page-session-manager.ts
packages/vario-vue/src/composables/useVarioPages.ts  # additive
```

- active/inactive/paused/disposed 状态机。
- max resident pages / max heap / LRU eviction。
- route KeepAlive 与 session pause 分开；不把所有隐藏 DOM 永久保留。
- 页面销毁后 WeakRef/heap snapshot 证明 context 可回收。

Session 的 Vue 3.4/3.5 lifecycle、SSR/hydration/isolation 和 heap 门禁见 [Phase 4](./vue3-deep-runtime/tasks/phase4-session-ssr-memory.md)；canary/consumer/rollback rehearsal 见 [Phase 5](./vue3-deep-runtime/tasks/phase5-rollout-and-release.md)。

### 3.3 MaterialManifest/Plugin

- props/events/slots/model/capability/version/migration 统一 manifest。
- registry 属于 Engine，不属于模块全局。
- unknown material 在 strict/untrusted 模式是阻断 diagnostic/error；legacy/默认兼容模式保留当作字符串标签的现有行为并发出迁移警告。
- plugins 可选 setup/validate/prepare/dispose，保留现有 wrap/decorate。

**Phase 3 验收**：G4 与 G5 独立验收。G4 要求 CONTRACT-6/7、CANVAS-1～5、PERF-D3；G5 要求 LIFE-1～5、PERF-T7/T8、MEM-3/4。两者不互相借用通过结果。

## Phase 4：生产硬化

### 4.1 安全与隔离

- 对表达式、action、loop、payload、节点数、深度、字符串长度做 cost quota。
- Worker 执行不可信重计算；服务 capability 明确授权。
- 模糊测试 path/parser/validator/action。
- 依赖与 bundle 安全扫描。

### 4.2 SSR/hydration

- 每请求 Engine/Session 隔离。
- server render → client hydrate 覆盖 cond/show/loop/model/error/teleport。
- 禁止 render 期 state mutation。
- Teleport 输出契约与 host 注入文档化。
- 按 SSR-1～SSR-5 执行 50 并发请求隔离、0 hydration mismatch、Teleport 无效目标 diagnostic 与销毁后资源计数。

### 4.3 Observability

- 实现 no-op 默认 DiagnosticSink 与采样。
- 对接方可转发 OpenTelemetry/Sentry/自建指标，但 Core 不直接绑定供应商。
- 建立 render/action/expression/cache/page 指标与隐私红线。

### 4.4 发布治理

- 完善 Phase 0 已建立的 changeset/release manifest，加入 canary promotion 与自动回滚证据。
- API Extractor 或 d.ts snapshot。
- 将 Phase 1 已落地的 bundle/subpath budget 扩展到 Node/Vite/SSR/browser 版本矩阵，不在此才首次实现。
- npm tarball 空项目安装、Node/Vite/SSR/browser matrix。
- canary + compatibility fixtures 通过后才切 prepared runtime 默认。

**Phase 4 验收**：SEC-8、PERF-D4、MEM-5、SSR-1～SSR-5、OBS-1～OBS-5 及之前所有未关闭门禁全部通过，才进入 G6 Production Core。

## 灰度与回滚方案

### 灰度顺序

1. 开发环境只 prepare，不渲染，比较 diagnostics。
2. 内部示例页双引擎生成 DOM snapshot。
3. 可信小页面 1% prepared runtime。
4. 中型表单/列表 10%～50%。
5. prepared 成为默认，legacy 至少保留两个 minor 版本，移除只能进入 major-version 废弃流程。
6. 画布与不可信 Schema 单独准入，不随普通页面自动开放。

### 回滚触发

- DOM/事件/state compatibility fixture 不一致。
- update p95 超预算 20%。
- error rate、long task、heap retained 超门槛。
- migration 出现不可逆文档变更。

### 回滚手段

- Runtime mode 开关退回 legacy renderer。
- SchemaDocument migration 保留原文与 previous version，不就地覆盖唯一副本。
- Material migration 版本锁定。
- 新 StateStore/VM 每一步都保留公开 Facade，回滚不要求业务改调用代码。

## 每阶段完成定义

- 所有任务有源码路径、contract fixture 和失败用例。
- unit、source integration、browser mount、pack consumer 全通过。
- 文档与 diagnostics 同步更新。
- 没有新增全局可变 registry/cache/pool。
- 没有用扩大阈值掩盖算法复杂度。
- 任何公共语义变化都有 legacy fixture 和 migration。
