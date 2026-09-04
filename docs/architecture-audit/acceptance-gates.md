# 生产验收门禁

> 每个门禁只阻断它所属的能力准入，不阻止更低档、不包含该能力的阶段发布。只有 G6 `Production Core` 要求本文全部门禁通过。算法/次数/正确性门禁在所有环境执行；时间预算在固定 CI runner 上执行。

## 准入档与门禁归属

| 准入档 | 阶段 | 适用门禁 | 负责模块/证据产物 |
|---|---|---|---|
| G1 小型可信页 | Phase 0 | COMP-2/3/5/6、CONTRACT-1～4、SEC-1～7、STATE-1～4、EXPR-1～4、VM-1～7、VUE-1～6、RELEASE-1～6 | Core/Schema/Vue/Release；API snapshot、contract/security/browser/consumer fixtures |
| G2 prepared canary | Phase 1 | G1 + COMP-1/4、CONTRACT-5/7、PERF-A1/A4/A5/A6、BUNDLE-1～5、RELEASE-7 | Schema/Core/Package；prepare/cache/deep-tree/bundle probes |
| G3 中大型 Vue 页 | Phase 2 | G2 + VUE-7～9、DEPTH-1～8、PERF-A2/A3、PERF-T1～6、PERF-D1/D2、MEM-1/2 | Vue/Core；render counter、real browser、reference virtual adapter、heap snapshot |
| G4 画布 | Phase 3 | G3 + CONTRACT-6/7、CANVAS-1～5、PERF-D3 | Schema/Material/Canvas：patch/undo/worker/golden fixtures |
| G5 多页面 | Phase 3 | G3 + LIFE-1～5、PERF-T7/T8、MEM-3/4 | Core/Vue：PageSession state-machine/browser/heap fixtures |
| G6 Production Core | Phase 4 | 全部门禁，包含 SEC-8、PERF-D4、MEM-5、SSR-1～5、OBS-1～5 | Security/SSR/Observability/Release：fuzz、hydrate、isolation、telemetry 与 tarball matrix |

### ID 到实施归属

| ID 范围 | 最迟阶段 | Owner | 固定测试/产物 |
|---|---|---|---|
| COMP-2/3/5/6 | Phase 0 | Package/API | `tests/consumer/public-api` + d.ts/API Extractor snapshot |
| COMP-1/4 | Phase 1 | Prepared compatibility | dual-runtime browser + legacy-v0 adapter fixture |
| CONTRACT-1～4 | Phase 0 | Types/Schema | contract matrix + normalization/query golden |
| CONTRACT-5/7 | Phase 1 | Schema codec/migration/compiler | v0→v1 round-trip/idempotent/rollback/prepare golden |
| CONTRACT-6 | Phase 3 | Material | manifest valid/invalid/version fixtures |
| SEC-1～7、STATE-1～4、EXPR-1～4 | Phase 0 | Core security/state/expression | security regression + policy/cache boundary probes |
| SEC-8 | Phase 4 | Capability/Security | capability registry/fuzz/abuse suite |
| VM-1～7 | Phase 0 | Core VM | execution budget/cancel/batch/yield suite |
| VUE-1～6 | Phase 0 | Vue | source integration + real-mount/browser fixture |
| VUE-7～9 | Phase 2 | Vue feature adapters | event modifier/model/ref browser fixture |
| DEPTH-1～8 | Phase 2 | Schema compiler/Vue runtime | iterative prepare + real mount + path/state/loop counters |
| CANVAS-1～5 | Phase 3 | Schema compiler/Canvas | patch/undo/reorder/Worker suite |
| LIFE-1～5 | Phase 3 | PageSession/Vue | state-machine + heap/WeakRef suite |
| PERF-A1/A4/A5/A6 | Phase 1 | Prepare/Core | operation counter + fixed harness JSON |
| PERF-A2/A3、PERF-T1～6、PERF-D1/D2 | Phase 2 | Vue performance | render counter + production browser + virtual adapter |
| PERF-D3 | Phase 3 | Canvas performance | 60Hz patch/drag production-browser trace |
| PERF-T7/T8、MEM-3/4 | Phase 3 | Multi-page | multi-session browser + heap snapshot |
| PERF-D4、MEM-5 | Phase 4 | RUM/SSR | production RUM + concurrent SSR isolation |
| MEM-1/2 | Phase 2 | Loop/Vue | mount/unmount heap retainer suite |
| BUNDLE-1～5 | Phase 1 | Package | esbuild consumer + metafile budget |
| SSR-1～5 | Phase 4 | Vue SSR/Runtime | renderToString→hydrate + concurrent-request isolation matrix |
| OBS-1～5 | Phase 4 | Runtime diagnostics | sink contract/load/backpressure suite |
| RELEASE-1～6 | Phase 0 | Release | clean build + source/browser + pack/bin smoke |
| RELEASE-7 | Phase 1 起按准入档扩展 | Release/Package | API/migration/bundle/performance profile budgets |
| RELEASE-8 | 每个 Phase | Risk owner | 当前准入档所覆盖风险的 regression links |

## 1. 兼容性

| ID | 门禁 |
|---|---|
| COMP-1 | 现有 `useVario(schema, options)` 调用无需修改即可运行 prepared runtime |
| COMP-2 | 返回值 `vnode/state/ctx/refs/error/stats/find/findAll/findById/retry` 保留 |
| COMP-3 | `defineSchema(config)` 与 `execute(actions, ctx, options)` 签名保持兼容 |
| COMP-4 | 裸 SchemaNode 自动按 legacy v0 处理，不要求调用方先包装 document |
| COMP-5 | EventHandler 五种公开形式产生相同 normalized ActionPlan |
| COMP-6 | Phase 0 改实现前即对全部根/子出口、值/类型、构造器、overload 与关键行为生成 d.ts/API/contract snapshot；非预期 breaking diff 阻断 |

## 2. Schema 与物料契约

| ID | 门禁 |
|---|---|
| CONTRACT-1 | Types、validator、normalizer、runtime 先共用同一 fixture matrix；后续新增 codec/compiler 必须直接消费同一 matrix |
| CONTRACT-2 | `normalize(normalize(x))` 深度等价，且不删除 id/extension/Vue feature/model options/合法空值 |
| CONTRACT-3 | 每个内建 Action 合法 payload 通过，缺参数/错类型/unknown type 拒绝 |
| CONTRACT-4 | duplicate Node ID 阻断，root ID 与 first match 语义有测试 |
| CONTRACT-5 | `serialize → parse → migrate → normalize → prepare` golden fixture 无业务语义丢失 |
| CONTRACT-6 | MaterialManifest 校验 props/events/slots/models/version/capabilities |
| CONTRACT-7 | legacy v0 到 `SchemaDocument v1` 的每步 migration 纯函数、幂等、可回滚 |

## 3. Path 与状态安全

| ID | 门禁 |
|---|---|
| SEC-1 | `__proto__/constructor/prototype` 在任意 path 位置均不可读写；Object.prototype 保持干净 |
| SEC-2 | `$emit/$methods/$event/_get/_set` 等系统路径不能经 `_set` 或 action 覆盖 |
| SEC-3 | path 字符数、段数、数组 index 超预算时快速失败，不分配巨型数组 |
| SEC-4 | path cache 返回值不可由调用方修改；2000 边界不全清抖动 |
| STATE-1 | `_set` 失败抛 typed error，绝不调用成功 change callback |
| STATE-2 | direct state、Proxy、adapter、array action、VM set 全部产生一致 ChangeSet |
| STATE-3 | batch 中 N 次写只触发一次可消费的 UI transaction |
| STATE-4 | cache 不因任何写通道返回陈旧值 |

## 4. Expression 安全与缓存

| ID | 门禁 |
|---|---|
| SEC-5 | 表达式不能原地修改 state、prototype、DOM 或 runtime system API |
| SEC-6 | 只允许 exact method allowlist；`Object.*`、任意 `$*` 根放行测试必须失败 |
| SEC-7 | 不同 policy fingerprint 不共享 Plan/结果；高权限结果不能被低权限命中 |
| SEC-8 | capability 必须显式注册并标记 pure/cost/input limit/allowInExpression |
| EXPR-1 | `null`、`undefined`、false、0 均能被正确缓存和区分 miss |
| EXPR-2 | loop/slot/event lexical binding 与 state 同名时，作用域优先级稳定 |
| EXPR-3 | validator 允许的每种 AST node，evaluator 必须实现；反向亦然 |
| EXPR-4 | 99/100/101/500/2000 unique 工作集都有 hit/miss/evict 断言 |

## 5. VM

| ID | 门禁 |
|---|---|
| VM-1 | `maxSteps=1` 时任意 if/loop/batch 的第二个嵌套 action 被阻止 |
| VM-2 | 所有子动作共享一个 absolute deadline 与 executionId |
| VM-3 | timeout/cancel 后内建 action、call resultTo、batch commit 均不得继续写 state |
| VM-4 | custom handler 能收到 AbortSignal；旧二参数 handler 继续工作 |
| VM-5 | batch 任一动作失败后 state 恢复到 batch 前，错误保留每个失败 action |
| VM-6 | action/service registry 使用 own lookup；`constructor/toString/__proto__` 不是 handler |
| VM-7 | 大 loop 分批 yield，并按 item/body/native cost 消耗 budget |

## 6. Vue 正确性

| ID | 门禁 |
|---|---|
| VUE-1 | `ctx._set(1) → state=2` 连续写后 DOM 必须显示 2，不允许吞更新 |
| VUE-2 | lifecycle 节点普通 update：mounted 保持1、unmounted保持0、updated增加1 |
| VUE-3 | descendant setup/render/update 抛错进入 VarioErrorBoundary、onError 与 diagnostic |
| VUE-4 | 普通与组件化路径的 directives/ref/plugin/model/events 行为使用同一 fixture |
| VUE-5 | 任意深度动态 props 更新正确，不被静态缓存冻结 |
| VUE-6 | loop itemKey/indexKey、`$item/$index`、nested loop、scoped slot 全部正确 |
| VUE-7 | capture/passive/key/system/mouse modifiers 有明确支持表；未支持项在 compile 阶段报错 |
| VUE-8 | model default 不在 render 中写 state；lazy model 不为每轮 render 创建 timer |
| VUE-9 | ref registry 在 mount/update/unmount 后无陈旧 ref；loop ref 语义明确 |

## 7. 画布与多页面

| ID | 门禁 |
|---|---|
| CANVAS-1 | `findById(id).patch()` 不得 no-op；只读输入返回 typed error |
| CANVAS-2 | patch 只重编译受影响节点/子树，并产生 revision 与 reversible record |
| CANVAS-3 | undo/redo 1000 次后 document 与 PreparedView 一致 |
| CANVAS-4 | 5000 节点 compile/validate 可在 Worker 执行，主线程无 >50ms long task |
| CANVAS-5 | reorder/move 后 stable Node ID 与 Vue key 不变，组件本地状态不丢 |
| LIFE-1 | PageSession 支持 active/inactive/paused/disposed 状态机 |
| LIFE-2 | inactive 页不会执行 render、namespace refresh 或未授权后台 action |
| LIFE-3 | dispose 后 watcher/timer/subscription/running execution 为0 |
| LIFE-4 | 页面 A/B 的 model/material/plugin/action registry 不互相覆盖 |
| LIFE-5 | 100 次 create/dispose 后 RuntimeContext WeakRef 可回收，无持续增长斜率 |

## 8. 性能预算

### 8.1 算法门禁

| ID | 场景 | 门禁 |
|---|---|---|
| PERF-A1 | N 个平铺节点 prepare parent/index | index 写次数 ≤3N，禁止 N² |
| PERF-A2 | 1000 行 loop 更新一项 | 只 render 1 个 cell + 必要祖先 |
| PERF-A3 | 更新无依赖 state | 相关 node render 数为0 |
| PERF-A4 | 101 unique expressions | 单次成本 ≤100 unique 的2倍 |
| PERF-A5 | Core VM 5000 次 loop 空 body | 父状态字段 5000 相对0的 p95 耗时比 ≤2.0，且 release 路径不得枚举父 Context 继承字段 |
| PERF-A6 | Schema 深树 10,000 | 不栈溢出；受 maxDepth/maxNodes 可控中止 |

### 8.2 深度与更新粒度门禁

| ID | 场景 | 门禁 |
|---|---|---|
| DEPTH-1 | compiler-only 10,000 层链 | 使用显式栈完成扫描或按 policy 主动中止，不出现 JavaScript RangeError；不解释为 DOM 支持 |
| DEPTH-2 | `D∈{32,64,100}` 全链路 | native、动态区域和真实组件 fixture 的最深节点、mount/update/unmount 全部正确 |
| DEPTH-3 | `D>effectiveMaxDepth` | 创建任何 Vue VNode 前返回含 node/path/actual/limit/phase 的 typed diagnostic，DOM 不得出现半棵树 |
| DEPTH-4 | descendant/递归异常 | `children-resolver`、slot 和 loop 不得 catch 后返回 null；错误进入固定 ErrorBoundary/diagnostic |
| DEPTH-5 | model/path 深度 | policy 内读写与 DOM 正确；超限不改 state、不发成功 ChangeSet；Schema/path 使用统一预算合同 |
| DEPTH-6 | 静态深链 | 只创建必要动态/语义边界，内部组件数不得按每个 Schema 节点线性增长 |
| DEPTH-7 | `N=1`、`S=100..20,000` 单叶更新 | operation counter 不遍历整个 state 图，p95 最大/最小比值 `≤2.0` |
| DEPTH-8 | nested loop 展开 | 创建下一 cell 前检查 `maxExpandedNodes`；超限 virtualize 或 typed failure，不生成静默部分树 |

专项设计与实施映射见 [Vue 3 深层运行时规格](./vue3-deep-runtime/spec.md) 和 [阶段任务](./vue3-deep-runtime/tasks/README.md)。默认产品建议 `D≤50`，强制支持测试到 `D=100`；这与 compiler 10,000 层算法门禁是两个独立维度。

### 固定 runner 时间预算

下列数字是 **provisional budget**，用于防止目标架构重新退化；在首个 prepared runtime 候选进入 G2 前，必须在固定 runner 上执行两次基线校准并将阈值锁定到 `performance-budgets.json`。不得为了让线性/二次复杂度通过而放宽阈值。

固定协议：

- 记录不可变 `runnerId`/CPU/内存/OS、Node、Chrome、Vue、commit、production/development mode 与 power mode。
- 包与 Vue browser benchmark 使用 production build；开发模式另报告，不与阻断数据混用。
- 每场景先预热 20 次，再采样 50 次；独立进程重复 3 轮，使用三轮 p95 的中位数判定。
- 样本之间重置 DOM/Session/cache；需要 GC 的内存场景使用 CDP `collectGarbage`，时间场景不在样本内强制 GC。
- 保存每次原始 JSON 样本，不只保存中位数；结果必须包含正确性断言、render/DOM 次数与长任务。

| ID | 场景 | p95 预算 |
|---|---|---:|
| PERF-T1 | prepare 1000 节点/500 expressions | ≤20ms |
| PERF-T2 | 200 动态原生节点初始 mount | ≤16ms |
| PERF-T3 | 1000 动态原生节点初始 mount | ≤50ms |
| PERF-T4 | 1000 节点更新一个叶子 | ≤8ms |
| PERF-T5 | 1000 行虚拟列表初始可见区 mount | ≤50ms |
| PERF-T6 | 1000 行虚拟列表单项更新 | ≤8ms |
| PERF-T7 | 20 PageSession × 200 节点创建 | ≤50ms |
| PERF-T8 | 更新一个 active 页面 | ≤4ms，其他页面 render=0 |

时间从 mutation/prepare 开始，到 Vue DOM commit 的 `nextTick` 后结束；另采集下一帧 paint 与 INP，不得用“VNode 已定义”替代。

### 8.3 DOM 与长任务

| ID | 门禁 |
|---|---|
| PERF-D1 | 1000 行虚拟列表 DOM 元素受 viewport/overscan 限制，默认 ≤200 |
| PERF-D2 | 正常交互路径无 >50ms 主线程 long task |
| PERF-D3 | 画布拖拽 60Hz 时 library update p95 ≤8ms，剩余预算留给业务/layout/paint |
| PERF-D4 | 真实应用 RUM INP p75 ≤200ms；库级诊断可定位超预算 node/action |

## 9. 内存与生命周期

| ID | 门禁 |
|---|---|
| MEM-1 | loop frame release 后不保留 parent RuntimeContext |
| MEM-2 | 1000 行列表反复 mount/unmount 20 次后 retained heap 无持续增长 |
| MEM-3 | 100 PageSession create/dispose 后 retained 增量 ≤5MB 且斜率趋近0 |
| MEM-4 | Session 结果 memo、ref、plugin、namespace subscription 在 dispose 清空 |
| MEM-5 | SSR 并发请求的 registry/cache/state 不可互相可见 |

Heap 门禁使用 Chrome CDP collectGarbage + snapshot/retainer path，不只读取 `performance.memory` 单点。

## 10. SSR 与 hydration

| ID | 门禁 |
|---|---|
| SSR-1 | 每个 SSR 请求创建独立 Engine/Session，state/material/action/plugin/cache 不可跨请求可见 |
| SSR-2 | `renderToString → hydrate` 覆盖 cond/show/loop/model/error 后 0 hydration mismatch，DOM 与客户端直接 mount 等价 |
| SSR-3 | server render 期间不修改输入 Schema 或持久 StateStore；model default 等初始化在 render 前完成 |
| SSR-4 | Teleport 目标、缺失 host 和客户端注入有确定契约；无效目标返回 typed diagnostic，不产生静默 mismatch |
| SSR-5 | 50 个并发请求使用不同 state/registry 时输出完全隔离，销毁后 subscription/running execution 为0 |

## 11. Bundle 与 tree-shaking

| ID | 门禁 |
|---|---|
| BUNDLE-1 | 仅导入 `@variojs/core/runtime` 不包含 Babel parser |
| BUNDLE-2 | runtime path/state 基础子入口 ≤15KB gzip |
| BUNDLE-3 | `useVario` 主初始 chunk（Vue external、compiler lazy）≤35KB gzip |
| BUNDLE-4 | expression compiler 独立 lazy chunk ≤90KB gzip，CLI 预编译场景不下载 |
| BUNDLE-5 | 每个 subpath 有 side-effect/tree-shaking consumer probe |

## 12. Observability

| ID | 门禁 |
|---|---|
| OBS-1 | schema/page/node/action/expression/execution 有稳定 ID |
| OBS-2 | compile/render/action/cache/page lifecycle 事件可接入 no-op DiagnosticSink |
| OBS-3 | 错误默认不序列化 state、event payload、token、表达式原文或完整 stack 到用户侧 |
| OBS-4 | cache hit/miss/evict、node render count、long task、cancel/rollback 可测 |
| OBS-5 | telemetry sink 自身失败不会中断业务，且有采样/背压 |

## 13. 发布门禁

| ID | 门禁 |
|---|---|
| RELEASE-1 | lint 0 error；warning 有显式预算并逐步收紧 |
| RELEASE-2 | 每包 tsc + unit + source integration 通过；当前准入档启用 browser/SSR 时，对应 profile 也必须通过 |
| RELEASE-3 | npm tarball 在空 Vite/Node/SSR consumer 安装并执行 smoke |
| RELEASE-4 | CLI bin `--help/--version/validate/generate` smoke 全通过 |
| RELEASE-5 | 发布始终 clean build，dist hash 对应当前 commit/worktree |
| RELEASE-6 | manifest 不在 publish 时临时改写；Vue peer 与内部版本已在 tarball 验证 |
| RELEASE-7 | API snapshot、migration golden、bundle/perf budget 全阻断 |
| RELEASE-8 | 当前准入档所覆盖的 P0/P1 风险逐项关闭并链接到回归测试；G6 才要求全部 P0/P1 关闭 |

## 14. 建议 CI 顺序

```text
1. dependency graph / manifest validation
2. eslint + tsc
3. unit + contract + security + fuzz smoke
4. source integration
5. Vue real mount browser matrix
6. SSR render + hydrate matrix
7. algorithmic perf + fixed-runner perf
8. heap lifecycle
9. package build + bundle budgets
10. npm pack + empty consumer + CLI bin
11. docs build/link validation
12. publish dry-run
```
