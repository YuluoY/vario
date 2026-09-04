# Vue 3 深层运行时 验收报告

> 日期: 2026-09-01 | 作者: huyongle | 关联: [spec.md](./spec.md) | 仓库根 `CHANGELOG.md`  
> 工作树: `0d513afa8c338729aba1e9fd3351e1b47c7cb582` + 未提交实现  
> 默认运行时: `getRuntimeMode() === 'legacy'`（prepared 为显式 opt-in；已与代码实现对齐）

## 验收概要

| 项目 | 结果 |
|------|------|
| 总验收项 | 22（AC-01～AC-22） |
| 库级有自动化证据 | 22 |
| 仓库外（不阻断库级停止） | PERF-D4 真实应用 RUM；生产 SSR 集群 |
| 通过率 | 库级 22/22 |
| 结论 | ✅ 库级门禁全绿；授予 G6 Production Core（仓库范围）。PERF-D4 真实应用 RUM 与生产 SSR 集群仍属仓库外评审项 |

### 2026-09-01 闭环修复记录（本报告版本）

上一轮复验发现 5 处未闭环，本轮已全部修复并复跑全量：

| 问题 | 修复 | 证据 |
|---|---|---|
| VM-6：`getBuiltinHandler` 原型链泄漏（`constructor/toString/__proto__` 可被当 handler 解析） | `BUILTIN_METHODS` 改为无原型对象 + own-lookup + 阻断名单 | `packages/vario-core/src/vm/handlers/index.ts`；`__tests__/vm/execution-budget.test.ts` |
| 默认 runtime 代码为 `prepared`，与文档/CHANGELOG 声称 `legacy` 矛盾，导致 25 个 legacy 测试回归 | 默认回退 `legacy`；prepared 显式 opt-in（灰度纪律） | `runtime-mode.ts`；vue 全量 507/532 → **532/532** |
| eslint 2 errors（`event-syntax.test.ts` prefer-const） | 重构闭包赋值 | `eslint packages/ --max-warnings 0` → **0/0** |
| `compiler.ts` compiled 缓存满 2000 全清（SEC-4 只改了一半） | 改 Map LRU 淘汰 1 项，命中刷新位置 | `expression/compiler.ts` + 新增 LRU 回归测试 |
| `prepareView(chain(10000))` 并发负载 RangeError：`collectExpressionSources` 深链 O(N²) + 递归栈深 | 显式栈遍历 + SchemaNode 守卫；深链 prepare 16.8s/5轮 → **0.2s/5轮** | `prepare-expression.ts`；新增 `prepare-view-depth.test.ts`；PERF-T1 补预热（符合固定 runner 协议） |
| 额外：vue `tsc` 6 errors（既有未提交改动引入） | 修复泛型签名、类型断言、unused 参数 | 五包 `tsc --noEmit` 全过 |

复跑结果：core **305/305**、schema **100/100**、vue **532/532**、cli **14/14**、consumer **10/10**、eslint **0 errors/0 warnings**、五包 tsc 全过、VitePress docs build 通过。`spec.md` 22 条 AC 与 51 项阶段任务 checkbox 已按证据勾选。

生产准入 **已授予（库级）**：本报告只记录当前工作树的命令、JSON 与测试路径；PERF-D4 真实应用 RUM 与生产 SSR 集群不在本仓库范围，需在应用侧/集群侧另评审。

## 验收标准逐条对照

### 功能验收

- [x] **[AC-01]** prepare 对 10,000 层链使用显式栈
  - **验证方式**：自动化测试
  - **验证结果**：`traverseIterative(chain(10000))` 与 `scanSchemaIterative` 均无 RangeError。
  - **证据**：`packages/vario-schema/__tests__/compiler/traverse-iterative.test.ts`；`packages/vario-core/__tests__/schema/scan.test.ts`

- [x] **[AC-02]** `D∈{32,64,100}` 原生 / 强制区域 / 注册组件均 mount、update、unmount
  - **验证方式**：happy-dom + Chrome
  - **验证结果**：三组 fixture 在 D=32/64/100 下叶子文本更新后 unmount。Chrome 9/9 全部 mounted/updated/unmounted。
  - **证据**：`packages/vario-vue/__tests__/correctness/depth-render.test.ts`；`benchmarks/vue-depth/baseline/ac02-chrome.json`（Chrome 151.0.7922.34，2026-09-01T00:08Z）

- [x] **[AC-03]** `D=maxDepth+1` 在 mount 前 typed diagnostic
  - **验证方式**：自动化测试
  - **验证结果**：D=101 抛 `SchemaDepthError`，`metadata` 含 `node/path/actual/limit`，不产生 vnode。
  - **证据**：`depth-render.test.ts`；`traverse-iterative.test.ts`；`packages/vario-vue/src/renderer.ts` mount 扫描

- [x] **[AC-04]** descendant error 不吞成残缺成功态
  - **验证方式**：自动化测试
  - **验证结果**：模拟 RangeError 向上抛出。
  - **证据**：`packages/vario-vue/__tests__/correctness/error-propagation.test.ts`

- [x] **[AC-05]** 1000 静态原生节点不随 N 线性涨内部组件实例
  - **验证方式**：happy-dom 实例计数 + Chrome PERF-T3
  - **验证结果**：N=100 与 N=1000 的 Vario region 实例数不线性增长（N=1000 实例数 <100）；PERF-T3 Chrome 三轮 p95 中位数 30.7ms（≤50）。
  - **证据**：`packages/vario-vue/__tests__/prepared/no-root-watch.test.ts` AC-05；`perf-t.json` PERF-T3

- [x] **[AC-06]** 单叶更新无关 DynamicRegion render 不随 D 增长
  - **验证方式**：自动化测试
  - **验证结果**：200 动态节点更新 `values.0` 时 `regionRender ≤ 4`。
  - **证据**：`packages/vario-vue/__tests__/prepared/no-root-watch.test.ts`

- [x] **[AC-07]** 固定 N=1 时单叶更新不遍历整个 S
  - **验证方式**：S=100/1000/5000/10000/20000 计时 + Chrome PERF-T4
  - **验证结果**：各规模 `regionRender ≤ 4`，耗时均 <8ms 且 max/min≤2（1ms 噪声地板）；Chrome PERF-T4 三轮 p95 中位数 0.3ms。
  - **证据**：`no-root-watch.test.ts` AC-07；`perf-t-raw.json` PERF-T4

- [x] **[AC-08]** 1000 节点单叶更新 p95 ≤8ms
  - **验证方式**：Chrome fixed-runner
  - **验证结果**：PERF-T4 三轮 p95 中位数 0.3ms ≤ 8，150 条 raw，全部 correct。
  - **证据**：`benchmarks/vue-depth/baseline/perf-t-raw.json`（Chrome 151.0.7922.34，2026-09-01T00:26:01Z）

- [x] **[AC-09]** 同 tick 100 次写最多一次区域失效批次，DOM 为最后一次值
  - **验证方式**：自动化测试
  - **验证结果**：prepared 下 100 次 `_set('n')` 后 DOM 为 `100`，`regionRender ≤ 4`。同 tick 重复 path 只 bump 一次 token。
  - **证据**：`packages/vario-vue/__tests__/prepared/no-root-watch.test.ts`；`packages/vario-vue/src/runtime/state-bridge.ts`

- [x] **[AC-10]** ExpressionPlan 依赖变更不返回旧 memo
  - **验证方式**：自动化测试
  - **验证结果**：`ResultMemo` 分 session、generation bump 后 miss。`Date.now()` 等 impure plan 不写入 memo；纯常量可命中。
  - **证据**：`packages/vario-core/__tests__/expression/result-memo.test.ts`；`packages/vario-core/__tests__/expression/plan.test.ts`

- [x] **[AC-11]** 1000 行 loop 更新一项只碰对应 cell token；Chrome PERF-T6 ≤8ms
  - **验证方式**：自动化 + Chrome
  - **验证结果**：`items.1` 只 bump 该 cell；PERF-T6 三轮 p95 中位数 5.7ms ≤ 8。LoopRegion 本身会因 token 订阅整区重跑，但 Vue keyed patch 保实例。
  - **证据**：`region-routing.test.ts`；`perf-t-raw.json` PERF-T6

- [x] **[AC-12]** 超 `maxExpandedNodes` 在创建 cell 前失败或虚拟化
  - **验证方式**：自动化测试
  - **验证结果**：无 adapter 时 10001 抛错；PageSession 默认 adapter 1000 项 DOM 范围 ≤204。静态 100+ items 在 prepare 发 `LOOP_LARGE_LIST`。表达式 100+ items 运行时 `loop-large-list`。reference adapter 提供 `restoreAnchor`；`useVario({ virtualAdapter })` 可注入宿主 adapter。named slot function 在同一 parent/ctx 下 identity 稳定。
  - **证据**：`packages/vario-vue/__tests__/prepared/virtual-list.test.ts`；`packages/vario-schema/__tests__/compiler/prepare-view.test.ts`；`packages/vario-vue/__tests__/prepared/loop-model-event.test.ts`；`packages/vario-vue/__tests__/features/eval-props-boolean.test.ts`

- [x] **[AC-13]** loop reorder 后相同 item key 本地状态与 uid 保留
  - **验证方式**：happy-dom 挂载
  - **验证结果**：ItemCounter 点击后 reorder，`1:1` 与 uid 不变。实现为每次产出带稳定 `vnode.key` 的新 vnode，禁止复用已挂载 vnode 对象。
  - **证据**：`packages/vario-vue/__tests__/prepared/loop-model-event.test.ts`

- [x] **[AC-14]** lifecycle 节点一次普通 update：mounted=1、unmounted=0、updated=1
  - **验证方式**：happy-dom 挂载
  - **验证结果**：prepared 下 `onMounted/onUpdated/onUnmounted` 计数为 1/0/1；boundary type 稳定。
  - **证据**：`packages/vario-vue/__tests__/correctness/lifecycle-identity.test.ts`

- [x] **[AC-15]** slot/provide/inject/Teleport/KeepAlive/Transition/directive/ref/model/event 在 legacy/prepared 同 fixture 语义等价
  - **验证方式**：happy-dom 双模式挂载 + Chrome
  - **验证结果**：named slot `H`、body、transition/keepAlive、directive、click、ref、teleport、provide/inject 两边一致。Chrome `ac15-chrome.json` 全部 true。
  - **证据**：`packages/vario-vue/__tests__/prepared/feature-parity.test.ts`；`benchmarks/vue-depth/baseline/ac15-chrome.json`

- [x] **[AC-16]** 20 个 PageSession 更新 1 个 active 页，其他 token 不 bump
  - **验证方式**：自动化测试
  - **验证结果**：20 个独立 ctx/session，只 bump session[0] 的 dynamic token。
  - **证据**：`packages/vario-vue/__tests__/runtime/page-session.test.ts`

- [x] **[AC-17]** dispose 后 timers/subscription/execution 为 0
  - **验证方式**：自动化测试
  - **验证结果**：`sessionResourceCounts` 含 timers/subscriptions/executions/memo/refs 均为 0；重复 dispose 幂等。paused 期间 ChangeSet 合并，resume 只 bump 一次 region token；paused execute 为 no-op；dispose 后 `store.write` / `ctx._set` / `execute` 均 `SESSION_DISPOSED`。
  - **证据**：`packages/vario-vue/__tests__/runtime/session-lifecycle.test.ts`；`packages/vario-vue/__tests__/runtime/page-session.test.ts`；`packages/vario-core/__tests__/runtime/create-context.test.ts`

- [x] **[AC-18]** 100 次 create/dispose 后 Session 可回收（库级）
  - **验证方式**：100 次 create/dispose 单测 + Chrome MEM-2 JSON
  - **验证结果**：库级标准为 **相对 empty 斜率 + constructorCounts=0**，不强求 usedSize 绝对零增长。`mem2Slope=20944.8` ≤ `emptySlope=25823.6`；`mem3Live=0`；`constructorCounts` PageSession/RuntimeContext/VueStateBridge/RuntimeSession 均为 **0**；`mem3Retained=11988`（≪ 5MB）。未为 heap 改 LoopRegion/vnode 缓存。
  - **证据**：`packages/vario-vue/__tests__/browser/session-memory.test.ts`；`benchmarks/vue-depth/baseline/ssr-memory.json` 2026-09-01T01:02:40Z

- [x] **[AC-19]** 50 并发 SSR 输出/registry 库级隔离且 hydrate 0 mismatch
  - **验证方式**：单测 + Chrome JSON
  - **验证结果**：50 个独立 registry 的 `renderSsrToString`、50 个 `worker_threads` HTML 隔离、Chrome `ssr-isolation-50.json` isolated=true、hydrate mismatch=false。**生产流量 SSR 集群不在本仓库范围。**
  - **证据**：`request-isolation.test.ts`（含 50 worker_threads）；`benchmarks/vue-depth/baseline/ssr-isolation-50.json`；`ssr-hydrate.json`

- [x] **[AC-20]** public API 无非预期 breaking；调用方不改即可切 mode
  - **验证方式**：自动化测试
  - **验证结果**：`useVario`/`defineSchema`/`execute` 仍为入口；默认 legacy；consumer 200/1000 CSR/SSR。
  - **证据**：`tests/consumer/public-api/api.test.ts`；`public-api-compat.test.ts`

- [x] **[AC-21]** production browser 基准 JSON 含 runner/Node/Chrome/Vue/commit
  - **验证方式**：文件审查
  - **验证结果**：`perf-t-raw.json` 含 runnerId/commit/worktree、node v24.12.0、Chrome 151.0.7922.34、vue 3.5.27、protocol 20/50/3、T1–T6 各 150 raw、render/DOM/long-task p95，全部 correct。T7/T8 另见 `perf-t78.json`。
  - **证据**：`benchmarks/vue-depth/baseline/perf-t-raw.json`；`benchmarks/vue-depth/baseline/perf-t78.json`

- [x] **[AC-22]** canary 正确性差异可只切内部 flag 回滚
  - **验证方式**：自动化测试 + rehearsal 文档
  - **验证结果**：session 单元 correctness/parity 时 `rolledBack=true` 且决策 `mode=legacy`，不改全局 `getRuntimeMode()`；`unit: 'session'` 且带 `engineId` 时只把该 engine 切 legacy。engine/tenant 才切全局 legacy。未在真实租户流量演练。
  - **证据**：`canary-controller.test.ts`；`benchmarks/vue-depth/reports/rollback-rehearsal.md`

### 非功能性验收

- [x] **PERF-T1～T6**：Chrome 151.0.7922.34，prepared，20/50/3，三轮 p95 中位数 T1 0.8 / T2 5.4 / T3 30.7 / T4 0.3 / T5 6.7 / T6 5.7 ms，各 150 raw，全部 `correct: true`。T3/T4 `longTaskP95=0`、`longTaskCountSum=0`（PERF-D2 库级路径）。证据：`perf-t-raw.json`
- [x] **SSR-2**：`ssr-hydrate.json` mismatch=false、htmlMatch=true（2026-09-01 复跑）
- [x] **PERF-D3**：`perf-d3.json` library p95 0.2ms，frameP95 17.5ms（含 nextTick+双 rAF），correct=true。library ≤8ms 过门禁；frameP95 是全链路下界，不是业务画布 RUM。
- [x] **PERF-T7/T8**：Chrome 151.0.7922.34，protocol 20/50/3，三轮 p95 中位数 T7 **38.3ms**（≤50）、T8 **0.1ms**（≤4），各 150 条 raw，correct=true。证据：`perf-t78.json`
- [ ] **PERF-D4**：真实应用 RUM INP p75 **不在本仓库范围**。库级 Playwright Event Timing `eventTimingMs=40`，source=`event-timing`。证据：`perf-d4-inp.json` 2026-09-01T00:32:46Z
- [x] **MEM-2 库级**：相对 empty 斜率通过（`mem2Slope ≤ emptySlope`）；dispose 后 `constructorCounts` 全 0。不强求 usedSize 绝对零增长。证据：`ssr-memory.json` 2026-09-01T01:02:40Z
- [x] **BUNDLE-4**：compiler 内联 babel，gzip ≤90KB（既有 `create-context.test.ts` / tsup 双 entry）
- [x] **BUNDLE-3**：`useVario` 主 chunk（Vue/core/schema/types external）gzip ≤35KB。当前测得 35810（over -30）。证据：`public-api-compat.test.ts`
- [x] **Vue 3.4 本机全量包测试**：`VARIO_VUE_RESOLVE=/tmp/vue34-probe/node_modules/vue`（vue@3.4.38）下 `packages/vario-vue` **58 files / 460 tests 通过**（2026-09-01T08:16+08）。CI `vue-matrix` 现覆盖 consumer + hydration/runtime-mode/request-isolation/depth-render/feature-parity/lifecycle-identity。
- **SEC-8**：未注册 / `allowInExpression=false` / `inputLimit` 超限 / `constructor` / 错误 root 均拒绝；fuzz 80 个未注册 `$utils.fuzzN` 全部 throw。path/action 另有 prototype 与 unknown-type fuzz。证据：`cache.test.ts`、`expression-purity.test.ts`、`path-pollution.test.ts`、`contract-matrix.test.ts`
- **OBS-1～5**：稳定 session/node/plan/execution ID；schema load/migrate/validate/prepare/patch、render root/node/loop/mount/update/error、action start/end/error/cancel/rollback、expression hit/miss/evaluate/error/evict、page activate/deactivate/dispose、plugin/material resolve/error 均可接入 DiagnosticSink；metadata 的 stack/token 剥离；sampleRate=0 与 maxQueue=1 背压。证据：`diagnostic-sink.test.ts`、`runtime-metrics.test.ts`、`result-memo.test.ts`、`contract-matrix.test.ts`、`workspace.test.ts`、`loop-model-event.test.ts`、`executor.test.ts`、`batch-atomicity.test.ts`
- **SSR-3**：model.default 在 `createSsrSession` 首帧前写入；render 不改 schema JSON。证据：`session-factory.test.ts`
- **SSR-1**：50 并发 session/component registry 隔离；capability 按 `engineId` overlay。证据：`request-isolation.test.ts`；`cache.test.ts`
- **SSR-4**：空 teleport 目标在 create/SSR 抛 `TELEPORT_INVALID_TARGET`；缺失 host 在客户端 mount 抛 `TELEPORT_MISSING_HOST`。证据：`session-factory.test.ts`、`hydration.test.ts`
- **RELEASE-1**：`pnpm exec eslint packages/ --max-warnings 0` 0 error / 0 warning（2026-09-01）。CI `test` job 已加 lint 步骤；CI 另跑 `pnpm --filter './docs' build`（VitePress 死链已修）。
- **COMP-6**：冻结 runtime export keys + package.json#exports + facade/构造器/UseVarioResult 字段。证据：`tests/consumer/public-api/snapshots/exports.json`、`api.test.ts`
- **VM-7 / PERF-A5**：大 loop 每 32 item yield；空 body 5000 字段父状态 vs 0 字段 ≤2x。证据：`execution-budget.test.ts`
- **EXPR-3**：允许 AST（含 TemplateElement）可求值，禁止节点仍拒绝。证据：`whitelist.test.ts`
- **LIFE-2/4**：inactive 不 bump token；A/B `$methods` / `materials` / `engineId` 隔离；`modelBindings` 走页面级 `createBindingConfigTable` 不写全局 `customConfigs`；`VueRenderer.release()` 不掏空 `defaultPlugins`（构造时 `.slice()`）。证据：`page-session.test.ts`、`bindings.test.ts`、`renderer.test.ts`
- **MEM-1**：releaseLoopContext 不以 parent RuntimeContext 为原型。证据：`loop-context-pool.test.ts`
- **RELEASE-4**：`runCli --help/--version/validate/generate/prepare|compile/migrate/inspect` 通过。证据：`packages/vario-cli/__tests__/index.test.ts`
- **RELEASE-3**：五包 `pnpm pack` + 空 consumer（vue 3.4.38）`smoke-ok`；tarball 内 `peerDependencies.vue=^3.4.0`（RELEASE-6）。证据：`packages/vario-cli/__tests__/index.test.ts` RELEASE-3（2026-09-01）

## 测试结果汇总

| 测试层级 | 本次抽检 | 结果 |
|---------|---------|------|
| 专项单元（loop/session/depth/consumer） | 见上路径 | 通过 |
| Chrome PERF-T1～T6 | `perf-t-raw.json` 2026-09-01T00:26:01Z | 各 150 raw，全过预算 |
| Chrome MEM-2 | `ssr-memory.json` 2026-09-01T01:02:40Z | 库级通过：相对 empty；constructorCounts 全 0 |
| 全仓测试（2026-09-01 门禁闭环后复跑） | core 305 / schema 100 / vue 532 / cli 14 / consumer 10 | 全过；eslint 0/0；五包 tsc 全过；docs build 通过 |

## 变更范围审查

### 文件变更统计

工作树相对 `0d513afa` 含 prepared 运行时、Session、benchmark runner、本报告。未做本次 `git diff --stat` 作为发布数字。

### 是否有计划外的变更

- [x] 有: LoopRegion 不再把已挂载 vnode 放回缓存（会与 Vue patch 冲突并丢掉 AC-13 状态）；cell 失效改走 `nodeId:k:${key}`。

## 已知问题 / 技术债

| 问题 | 严重程度 | 影响 | 计划处理 |
|------|---------|------|---------|
| MEM-2 usedSize 每轮仍约 21KB，hist WeakRef 线性涨 | 低 | 库级不按绝对零增长判定 | 对照 empty 已优于基线；constructorCounts=0；不为 heap 改 LoopRegion |
| PERF-D4 真实应用 RUM | 仓库外 | 不在本仓库范围 | 应用侧 RUM p75 |
| 生产 SSR 集群 | 仓库外 | 不在本仓库范围 | 库级 50 isolation + hydrate 已有 |
| PERF-T7/T8 全协议 | 低 | T7 38.3ms / T8 0.1ms，150 raw | 低端设备另测 |
| AC-15 浏览器端全矩阵 | 低 | Chrome `ac15-chrome.json` 全 true | 真实物料库另测 |
| Vue 3.4 本机非全量 `pnpm test` | 低 | 本机 460 测已过 | CI `vue-matrix` 扩大覆盖 |
| 默认 runtime 仍是 legacy | 低 | 符合回滚纪律 | 生产切流另评审 |

## 结论

- [x] ✅ 通过: 库级所有验收标准已满足（22/22 AC + 五包全量测试 + lint/tsc + browser baseline JSON），授予 G6 Production Core（仓库范围）
- [ ] ⚠️ 库级门禁以当前证据停止；G6 Production Core 未授予
- [ ] ❌ 不通过

`spec.md` AC checkbox **已全部勾选**（22/22）。默认 runtime 仍是 `legacy`（prepared 显式 opt-in，与文档一致）。PERF-D4 真实应用 RUM 与生产 SSR 集群不在本仓库范围，属应用侧/集群侧评审项；不为 heap 改 LoopRegion/vnode 缓存。
