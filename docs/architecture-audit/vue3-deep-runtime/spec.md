# Vue 3 深层渲染与局部更新规格

> 日期：2026-09-01 | 作者：huyongle | 状态：已实施  
> 关联调研：[research-report.md](./research-report.md)  
> 关联总审计：[../index.md](../index.md)

## 背景与动机

`@variojs/vue` 需要同时服务普通 Vue 3 页面、低代码画布预览、多页面驻留、嵌套表单、动态 slot 和大列表。当前实现把整个 state 的深监听、表达式缓存失效和根 Schema VNode 重建绑定在一起：一个叶子写入既受状态图规模 `S` 影响，也会重新解释节点树 `N`；深度 `D` 和循环展开 `R` 还会引入额外的栈、组件与内存风险。

本规格定义内部重构的可验收目标。调用方继续使用现有 `useVario(schema, options)` 和公开导出；PreparedView、Session、区域组件、依赖版本、循环 cell 与错误边界均为内部演进或 additive 能力。

## 状态边界

- 文档设计：已实施。
- 代码实现：已完成并通过全量测试（core 305 / schema 100 / vue 532 / cli 14 / consumer 10）。
- 本规格中的未勾选验收项不是当前能力声明。
- 只有对应任务完成、测试证据保存并通过总体验收门禁后，才能更新为“已实现”或“生产可用”。

## 术语

| 术语 | 定义 |
|---|---|
| `N` | Schema 静态节点总数 |
| `D` | Schema 最大父子嵌套深度 |
| `S` | 当前页面业务 state 中可被 Vue 遍历的对象/字段规模 |
| `R` | loop 展开后的运行时实例/VNode/DOM 总量 |
| `AΔ` | 一次变更真正影响的动态区域集合大小 |
| `PreparedView` | 由 Schema 迭代式编译得到的只读扁平执行计划 |
| `PreparedNode` | 含 stable ID、父子索引、静态/动态字段计划和区域归属的单节点计划 |
| `DynamicRegion` | 具有表达式、状态、loop、slot、model、ref、生命周期或错误语义的稳定更新边界 |
| `StaticRegion` | 无运行时依赖、由上级区域一次生成并复用的连续静态子树 |
| `PageSession` | 单页 state、scope、memo、effect、timer、subscription 与 execution 的生命周期所有者 |
| `ScopeFrame` | event/loop/slot 的不可变词法绑定帧，不复制整份 RuntimeContext |

## 用户故事

| 编号 | 角色 | 用户故事 | 价值 |
|---|---|---|---|
| US-1 | Vue 应用开发者 | 作为 Vue 应用开发者，我希望现有 `useVario` 调用在内核升级后无需改写，以便逐页灰度而不是一次迁移全部业务 | 兼容迁移 |
| US-2 | 低代码画布开发者 | 作为低代码画布开发者，我希望修改一个深层节点只重编译受影响区域，以便拖拽和属性编辑不会重建整页 | 高频编辑 |
| US-3 | 页面开发者 | 作为页面开发者，我希望 `D≤100` 的合法嵌套具有确定的 mount/update/unmount 语义，以便复杂表单不会静默丢节点 | 正确性 |
| US-4 | 物料开发者 | 作为物料开发者，我希望 slot、provide、Teleport、KeepAlive、model、ref 和生命周期在区域边界前后语义一致，以便组件库可直接接入 | Vue 生态兼容 |
| US-5 | 平台运行时开发者 | 作为平台运行时开发者，我希望每个页面能 pause/resume/dispose，以便多页面驻留不持续消耗 watcher、timer 和执行预算 | 资源隔离 |
| US-6 | 性能负责人 | 作为性能负责人，我希望基准同时报告正确性、render 数、DOM 数、p95 与 retained heap，以便避免只优化某个毫秒数而引入错误 | 可量化准入 |

## 目标

- Schema prepare 使用显式栈，复杂度 `O(N)`，不依赖 JavaScript 递归栈。
- 普通 state leaf 更新不替换根 VNode，不遍历无关状态图，不重渲染无关区域。
- 在语义正确的前提下，把组件实例限制到动态、有状态或特殊 Vue 语义边界。
- loop/slot 使用 stable ScopeFrame 和 cell identity，嵌套展开受预算和虚拟化约束。
- PageSession 明确管理 Vue effects、订阅、timer、async execution、refs 与 memo。
- 超深、超节点、超展开输入在 mount 前返回 typed diagnostic，不静默截断。
- 保留当前完整 public API surface 与安全合法行为，并支持 legacy/prepared 双轨灰度。

## 非目标

- 不承诺渲染 10,000 层真实 DOM；10,000 层只用于验证 prepare 不栈溢出。
- 不把每个 Schema 节点都转换成 Vue 组件。
- 不绕开 Vue 自建 DOM renderer，也不放弃第三方 Vue 组件生态。
- 不在本专项重写表达式语法、Action DSL 或物料 Schema 的公开写法。
- 不用单台开发机的中位数作为跨设备 SLA。
- 不在依赖版本正确性落地前直接删除 deep watch。
- 不把 `markRaw` 应用于业务 state 或 loop item 来换取表面性能。

## 功能需求

### FR-1: 迭代式 PreparedView

- **优先级**：P0
- **触发条件**：`useVario` 首次接收 Schema、Schema root/revision 改变，或画布提交结构 patch。
- **预期行为**：用显式 work stack 单次建立 nodeId、parentId、childrenIds、depth、path、feature flags、regionId、expression/action plan 和 diagnostics；相同 root+revision 可复用只读计划。
- **边界条件**：duplicate ID、cycle、`D/maxNodes/maxExpandedNodes` 超限必须在 Vue mount 前 typed failure；不得 catch RangeError 后返回部分计划。

### FR-2: 稳定 VarioRoot 与 PageSession

- **优先级**：P0
- **触发条件**：Vue 组件 mount、普通 state mutation、Schema revision 切换或组件 unmount。
- **预期行为**：根 VNode identity 在普通 state 更新时保持不变；PageSession 持有当前 PreparedView、StateStore、scope、effect scope、memo、refs、diagnostic sink 与 execution registry。
- **边界条件**：每个 SSR 请求和每个页面必须独立 Session；组件卸载或显式 dispose 后不可继续执行 watcher/timer/action。

### FR-3: 依赖版本与动态区域

- **优先级**：P0
- **触发条件**：PreparedNode 中存在 cond/show/text/props/model/events/slot/loop 或其他运行时依赖。
- **预期行为**：ExpressionPlan 记录静态依赖；StateStore 为写入生成 ChangeSet 与 path version；只有依赖相交的 DynamicRegion 失效并重新 render。
- **边界条件**：动态 key、能力调用或无法静态确定的依赖必须进入显式 conservative region，不得伪装成静态；依赖版本完成前保留 legacy invalidation fallback。

### FR-4: StaticRegion 与组件边界策略

- **优先级**：P1
- **触发条件**：prepare 对连续无运行时依赖的节点进行区域划分。
- **预期行为**：StaticRegion 只在 plan revision 或父级结构变化时重建；DynamicRegion 使用 module-level 固定组件 type，props 只含稳定 primitive ID/revision，Session 通过 typed provide/inject 获取。
- **边界条件**：不得把每轮新建的 schema clone、path array、nodeContext、parentMap 或闭包作为用于跳过更新的边界 props；原生静态 1000 节点的内部组件实例数不得随 `N` 线性增长。

### FR-5: 固定 Vue 语义边界

- **优先级**：P0
- **触发条件**：Schema 使用 lifecycle、error fallback、provide/inject、Teleport、KeepAlive、Transition、directive 或 ref。
- **预期行为**：这些能力由 module-level 固定组件/adapter 实现，legacy 与 prepared renderer 消费同一语义 fixture；普通 update 不改变组件 type 或错误边界 identity。
- **边界条件**：descendant setup/render/update 错误必须进入 typed diagnostic 与 fallback；不允许 children resolver 静默返回 null。

### FR-6: 稳定 LoopRegion 与 ScopeFrame

- **优先级**：P0
- **触发条件**：PreparedNode 含 loop，数组增删改、reorder，或嵌套 loop/slot 读取词法别名。
- **预期行为**：模板 plan 只编译一次；LoopRegion 按稳定 item key 维护 cell；每个 cell 持有可更新 ScopeFrame，不 clone Schema；单项字段变化只更新一个 cell 及必要祖先。
- **边界条件**：duplicate/unstable key 返回 diagnostic；无 key 时 index fallback 明确标警告；嵌套展开超过 `maxExpandedNodes` 时停止创建新 cell，不产生部分静默页面。

### FR-7: 虚拟化与可见区契约

- **优先级**：P1
- **触发条件**：loop 规模超过配置阈值或宿主显式提供 `VirtualListAdapter`。
- **预期行为**：运行时只激活 visible+overscan cell，并把 viewport、estimate size、anchor、focus 与 a11y 策略交给宿主 adapter；数据和 key 语义不因虚拟化改变。
- **边界条件**：未知高度、嵌套滚动、键盘焦点、Teleport 和 SSR 必须有明确 fallback；未提供 adapter 时超预算返回 diagnostic，而不是偷偷渲染全部数据。

### FR-8: 深度、节点与路径预算

- **优先级**：P0
- **触发条件**：Schema prepare、model/path compile 或 loop 展开进入下一层/下一项。
- **预期行为**：集中预算对象记录 `maxDepth`、`maxNodes`、`maxExpandedNodes`、`maxPathSegments`，diagnostic 包含 pageId、nodeId、schema path、实际值与限制值。
- **边界条件**：默认生产建议 `D≤50`、强制验证 `D=100`；path 当前 20 段上限必须转为明确编译诊断或经版本化配置提升，不能在 `_set` 失败后仍报告成功。

### FR-9: 生命周期、暂停与销毁

- **优先级**：P1
- **触发条件**：多页面切换、KeepAlive 激活/失活、页面淘汰、SSR 请求结束或宿主调用 dispose。
- **预期行为**：PageSession 状态机至少包含 active/inactive/paused/disposed；pause 停止非必要区域 effect 和 action 调度，resume 合并期间 ChangeSet，dispose 清空所有资源。
- **边界条件**：Vue 3.4 兼容线不能直接依赖 3.5-only API；需 feature detect 或用订阅层实现；disposed Session 的任何调用返回 typed error。

### FR-10: 双轨兼容与灰度

- **优先级**：P0
- **触发条件**：prepared renderer 在开发、canary 或生产流量中启用。
- **预期行为**：`useVario` 调用方式、返回字段、根/子出口和合法行为 fixture 不变；shadow 模式比较 DOM、state ChangeSet、events、refs、diagnostics 与 lifecycle，不比较 VNode 对象身份。
- **边界条件**：安全收紧和明确 bug 修复可产生带迁移建议的差异；其他差异阻断切流；回滚只切内部 runtime mode，不要求业务改代码。

### FR-11: 性能与内存观测

- **优先级**：P1
- **触发条件**：prepare、region render、loop cell 更新、page lifecycle、SSR 或 benchmark 执行。
- **预期行为**：可采集 prepare nodes、dirty regions、render count、DOM count、long task、cache hit/miss/evict、active effects、retained Session 与耗时分位数。
- **边界条件**：生产观测默认采样且不包含 state、表达式原文或敏感 event payload；观测 sink 失败不得影响渲染。

### FR-12: SSR 与 hydration 隔离

- **优先级**：P1
- **触发条件**：服务端并发创建 Session、`renderToString`、客户端 hydrate 或请求结束。
- **预期行为**：只读 PreparedView 可按确定 key 共享；state、memo、refs、registry overlay、effect 和 running execution 必须请求隔离；hydrate 与客户端直接 mount 语义一致。
- **边界条件**：Teleport host、client-only component、随机 ID、时间相关表达式必须有 deterministic contract；50 个并发请求不可互相读取或覆盖状态。

## 非功能性需求

### 性能

- prepare：`O(N)`，parent/index 写入次数不超过线性预算，调用栈 `O(1)`。
- 单叶更新：成本由 `AΔ` 和真实 DOM 变化决定，不再与无关 `S` 或 `N` 线性增长。
- 同 tick 多次写：由 StateStore transaction 合并，默认每个 Vue tick 最多提交一次区域失效批次。
- 1000 节点单叶更新和 1000 loop 单项更新的固定 runner p95 目标均为 `≤8ms`；首轮校准可收紧但不得用放宽掩盖复杂度退化。
- 正常交互路径不得产生 `>50ms` library long task。

### 正确性

- `D∈{32,64,100}` 必须覆盖 mount、state update、schema revision、unmount、error 与最深节点实际存在断言。
- 任何异常不得通过返回 `null` 静默丢弃子树。
- lifecycle、slot、provide/inject、ref、Teleport、KeepAlive、Transition、directive、model 与 event 在 legacy/prepared 两条路径使用相同 fixture。

### 兼容性

- `useVario(schema, options)`、`defineSchema(config)`、`execute(actions, ctx, options)` 主使用方式保持不变。
- 全部包根/子出口、值/类型、overload、返回字段和当前安全合法行为进入 API/contract snapshot。
- 新的 Session 控制或 runtime mode 只能 additive；已公开内部工具如需替换，保留 deprecated shim。

### 可维护性

- Vue 层不重复实现 Core 的依赖、scope 或 transaction 规则。
- 组件 render 中禁止创建 component type、写默认 state 或创建无托管 timer。
- PreparedView 不引用可变 Schema 对象；任何画布 patch 通过 revision 和结构共享产生新计划。

### 可观测性与隐私

- diagnostic 至少含稳定 page/session/node/region/execution ID。
- 指标 sink 可关闭、可采样、可背压；默认不收集业务值。
- benchmark 保存原始样本、环境、commit、正确性和 render/DOM 计数。

## 默认预算与配置

| 配置 | 建议默认 | 强制行为 |
|---|---:|---|
| `maxDepth` | 100 | prepare 超限 typed diagnostic；产品规范建议普通页面控制在 50 内 |
| `maxNodes` | 10,000 | prepare 前/中止，不能构造部分 PreparedView |
| `maxExpandedNodes` | 5,000 | loop 创建 cell 前检查；虚拟化可按 active cell 另计 |
| `maxPathSegments` | 20，待兼容评审 | compile 与 write 使用同一政策，失败不发成功 ChangeSet |
| `maxActivePages` | 20，宿主可调 | 超限需 pause/evict 策略，不允许无限驻留 |
| `maxDirtyRegionsPerTick` | 按页面校准 | 超限发 diagnostic，可降级整页但必须可观测 |

预算值在固定 runner 与真实应用校准后可版本化调整；配置变化需要保存到 performance profile，不得散落 magic number。

## 影响范围

| 模块 | 影响类型 | 主要变更 |
|---|---|---|
| `@variojs/types` | additive | PreparedView/PreparedNode/Diagnostic/ChangeSet/Session 类型契约 |
| `@variojs/schema` | 重构 | 迭代式 prepare、预算、region/index、增量 patch |
| `@variojs/core` | 重构 | Versioned StateStore、ExpressionPlan、ScopeFrame、transaction |
| `@variojs/vue` | 重构 | stable root、region components、loop cell、boundary、PageSession |
| `@variojs/cli` | additive | validate/prepare profile、深度与预算 diagnostic 输出 |
| 测试与 CI | 新增 | custom renderer、browser、SSR、heap、fixed-runner performance |

## 依赖与前置条件

1. 先修当前 Core/Vue 失败用例并固化 legacy 合法行为。
2. 错误吞噬、动态 component type 和 render-time state/timer 副作用必须先消除。
3. PreparedView/StateStore/ExpressionPlan 契约稳定后，Vue 区域才能依赖版本更新。
4. legacy 与 prepared 双轨对比通过后，才允许移除根 deep watch。
5. stable LoopCell 完成后再接虚拟化；PageSession dispose 完成后再做多页/SSR 准入。

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|:---:|:---:|---|
| 依赖提取遗漏造成陈旧 UI | 中 | 高 | conservative region、版本回退、shadow 双轨、依赖 mutation matrix |
| 组件边界改变 slot/lifecycle/ref 语义 | 高 | 高 | 固定 type、共享 fixture、真实组件与 browser integration |
| loop key/ScopeFrame 改写破坏历史别名 | 中 | 高 | characterization、nested loop/slot golden、legacy shim |
| shallow/markRaw 误用切断业务响应性 | 中 | 高 | 类型封装、禁止规则、mutation tests、Vue dev warning |
| 过多 DynamicRegion 造成组件膨胀 | 中 | 中 | region compiler 合并策略、component count budget、静态千节点门禁 |
| 过少区域导致失效范围过大 | 中 | 中 | dirty-region/render counters、profile-guided split，不允许运行时任意拆分 |
| Vue 3.4/3.5 scope API 差异 | 中 | 中 | peer matrix、feature detection、stop 基线、pause adapter |
| fixed runner 阈值不代表低端设备 | 高 | 中 | 算法门禁 + fixed runner + 真实应用 RUM 分层 |

## 验收标准

- [x] AC-01：`prepare` 对 10,000 层链使用显式栈完成或按 `maxDepth` 主动中止，进程不得出现 RangeError。
- [x] AC-02：`D∈{32,64,100}` 在 native、强制区域、真实注册组件三组 fixture 中验证最深节点、update 和 unmount 正确。
- [x] AC-03：`D=maxDepth+1` 在 Vue mount 前返回含 node/path/actual/limit 的 typed diagnostic，DOM 不出现残缺成功态。
- [x] AC-04：`children-resolver` 不再 catch 后返回 `null`；descendant error 进入固定 ErrorBoundary。
- [x] AC-05：1000 静态原生节点的内部 Vue 组件实例数不随 `N` 线性增长。
- [x] AC-06：深链只有最深叶子依赖变化时，无关 DynamicRegion render 数为 0，render 数不随 `D` 增长。
- [x] AC-07：固定 `N=1`、`S=100/1,000/5,000/10,000/20,000` 时，单叶更新不再遍历整个 `S`；operation counter 与耗时趋势均非线性增长。
- [x] AC-08：1000 节点只更新一个叶子时 fixed-runner p95 `≤8ms`，且只 render 受影响区域和必要祖先。
- [x] AC-09：同 tick 100 次写最多形成一次 Vue 区域 commit，最终 DOM 与最后一次值一致。
- [x] AC-10：ExpressionPlan 依赖值变更后绝不返回旧 memo；动态依赖进入 conservative region。
- [x] AC-11：1000 行 loop 更新一项时只更新 1 个 cell，fixed-runner p95 `≤8ms`。
- [x] AC-12：嵌套 loop 超 `maxExpandedNodes` 时在继续创建 cell 前失败或虚拟化，不产生部分静默树。
- [x] AC-13：loop reorder 后相同 item key 的组件本地状态与 ref identity 保留。
- [x] AC-14：lifecycle 节点一次普通 update 后 mounted=1、unmounted=0、updated=1。
- [x] AC-15：slot/provide/inject/Teleport/KeepAlive/Transition/directive/ref/model/event 在 legacy/prepared fixture 中语义等价。
- [x] AC-16：20 个 PageSession 中更新 1 个 active 页面，其他页面 region render=0。
- [x] AC-17：PageSession dispose 后 active effects、timer、subscription、running execution 和 refs 均为 0。
- [x] AC-18：100 次 create/dispose 后 retained heap 无持续增长斜率，RuntimeContext/Session 可回收。
- [x] AC-19：50 个并发 SSR 请求输出、state、memo、registry 和 diagnostic 完全隔离，hydrate 无 mismatch。
- [x] AC-20：完整 public API/contract snapshot 无非预期 breaking diff，业务 fixture 不修改调用方式即可在 prepared mode 运行。
- [x] AC-21：production browser 基准保存原始 JSON、runner/Node/Chrome/Vue/commit、正确性、render/DOM/p95/long-task 数据。
- [x] AC-22：legacy/prepared canary 任一正确性差异、p95 回退超过 20% 或 retained heap 超预算时可仅切内部 flag 回滚。

## 调研依据

| 调研项 | 结论 | 来源 | 可信度 |
|---|---|---|:---:|
| 根更新粒度 | deep state watch 后调度根 renderer | 项目源码、custom renderer、render counter | 高 |
| 深度上限 | 当前存在多条环境相关栈断点和静默截断 | 项目源码、独立进程探针、VNode 深度断言 | 高 |
| 组件化收益 | 每层组件化增加栈/实例，但当前不能隔离更新 | VarioNode 源码、真实组件探针、render counter | 高 |
| 移除 deep watch 前置 | 需要 dependency version，当前 cache 只检查存在性 | Core cache 源码、mutation reasoning、回归设计 | 高 |
| Vue 3 浅层能力 | 可用于只读 plan/service，不可用于业务 state | 本地 Vue API、最小响应性探针 | 高 |

信息源分类：**GitHub** 仅指当前仓库中的 workflow；**WebSearch** 和 **Context7** 均为 N/A。用户要求以当前代码逻辑为判断依据，本规格没有用远端文档或宣传基准替代本地证据。

## 参考资料

### 项目源码

- `packages/vario-vue/src/composables/internal/use-vario-phases.ts`
- `packages/vario-vue/src/renderer.ts`
- `packages/vario-vue/src/features/`
- `packages/vario-vue/src/bindings.ts`
- `packages/vario-core/src/expression/cache.ts`
- `packages/vario-core/src/runtime/path.ts`
- `packages/vario-schema/src/validator.ts`

### GitHub

- 当前仓库 `.github/workflows/`；远端资料 N/A。

### WebSearch

- N/A；本规格的事实结论来自当前源码与本地探针。
