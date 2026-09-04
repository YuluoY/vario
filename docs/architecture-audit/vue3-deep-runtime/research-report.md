# Vue 3 深层渲染与局部更新调研报告

> 日期：2026-08-31  
> 作者：huyongle  
> 状态：已完成  
> 代码基线：`main@0d513afa8c338729aba1e9fd3351e1b47c7cb582` + 当前未提交工作树  
> 关联：[需求规格](./spec.md) · [专项总览](./index.md)

## 调研目标

- 还原 `@variojs/vue` 从 reactive mutation 到 Vue DOM commit 的真实路径。
- 分离 Schema 节点数、嵌套深度、状态图规模、循环展开量和受影响区域五种成本。
- 验证“组件化后 Vue 会自动跳过更新”在当前 props、上下文和 VNode 生成方式下是否成立。
- 找出 N 层嵌套的正确性断点，而不只记录某次运行的毫秒数。
- 确认 Vue 3 的 `shallowRef`、`markRaw`、`effectScope` 等能力应放在哪一层，避免错误地切断业务响应性。

## 术语与测量模型

| 符号 | 定义 | 当前主要成本 |
|---|---|---|
| `N` | 一份 Schema 中的节点总数 | 根调度后的 VNode 重建、parentMap、attrs/children 生成 |
| `D` | Schema 最大父子嵌套深度 | JS 调用栈、Vue 组件栈、路径与上下文链 |
| `S` | Vue deep watch 可遍历的业务状态图规模 | 每次同步 mutation 的深遍历与索引重建 |
| `R` | loop 展开后的运行时实例/VNode/DOM 数 | loop cell、上下文、事件闭包与 patch 成本 |
| `AΔ` | 一次变更真正影响的动态区域数 | 目标架构中局部更新的主要成本 |
| `M` | 同一个 tick 内的状态写次数 | `flush: 'sync'` 下会重复触发状态遍历和失效逻辑 |
| `bₚ` | 父节点 `p` 的直接子节点数 | 当前 parentMap 对 sibling 的重复写入 |

当前状态更新的近似成本是：

```text
Θ(M × S) + Θ(N + Σ bₚ²) + Vue generic diff/DOM patch
```

在单链深树中，若每层持续复制完整 model/path stack 或拼接累计路径，临时分配总量可达到 `Σ depth(node)`，即 `O(D²)`。嵌套循环的实例量近似：

```text
R ≈ templateNodes × L1 × L2 × ... × Lm
```

其中任意一层数组增长都会乘到后续层级，不能只用静态 `N` 作为容量判断。

## 知识缺口与结论

| 编号 | 知识缺口 | 调研深度 | 信息源 | 结论 | 可信度 |
|---|---|---:|---|---|---|
| KG-1 | 单个 state leaf 是否只更新相关节点 | L3（三源） | Vue/Core 源码、custom renderer、render counter | 否；当前 deep watch 调度根 renderer，宽树和深链中的已组件化节点仍整体重渲染 | 高 |
| KG-2 | 状态图 `S` 是否与 Schema 更新无关 | L3（三源） | watcher 源码、production Node 探针、正确性断言 | 否；固定 `N=1` 时无关状态更新耗时随 `S` 近似线性增长 | 高 |
| KG-3 | 当前递归能否可靠支持任意 `D` | L3（三源） | renderer 源码、独立进程深度探针、实际 VNode 深度校验 | 否；断点取决于路径和组件边界，且 RangeError 可被吞后静默截断 | 高 |
| KG-4 | 每层组件化是否能解决深树问题 | L3（三源） | VarioNode 源码、Vue patch 探针、组件 render 计数 | 否；增加组件栈与 props 分配后更早溢出，更新仍沿整链发生 | 高 |
| KG-5 | 当前 Vue 编译器能否优化这些动态 VNode | L2 | 本地 Vue v3.5.27 VNode 检查、renderer `h()` 调用 | 运行时 `h()` 生成节点的 `patchFlag=0`、`dynamicChildren=null`，走通用 diff | 高 |
| KG-6 | loop 单项更新能否限制到一个 cell | L3（三源） | loop-handler 源码、render counter、现有 loop 回归测试 | 当前不成立；每轮 clone Schema、建 scope/path/closure，多层循环按实例量相乘 | 高 |
| KG-7 | 可以直接删除 deep watch 吗 | L3（三源） | expression cache 源码、state 写通道、失效控制器源码 | 不可以；结果缓存只检查依赖是否存在，不检查版本，直接删除会返回陈旧结果 | 高 |
| KG-8 | Vue 浅层响应式和 markRaw 应作用于哪里 | L2 | 本地 Vue API、最小响应性探针 | 适用于只读 PreparedView、组件定义和 Session 服务；不适用于业务 state/loop item | 高 |
| KG-9 | 多页面是否只需要多个 `useVario` | L3（三源） | composable/watch 源码、全局 registry/pool、页面驻留探针 | 只能挂载，不能证明生产隔离；缺少可暂停、可销毁、可计量的 PageSession | 高 |
| KG-10 | 现有深度测试能否证明 Vue 生产容量 | L3（三源） | 测试源码、定向复跑、真实 mount 探针 | 不能；现有 stress 用例只调用 `renderer.render`，未验证 Vue mount/update/实际深度 | 高 |

## 当前执行链

### 状态 mutation 到根渲染

1. `setupWatchers` 对整个 `reactiveState` 使用 `{ deep: true, flush: 'sync' }`。
2. 开发模式通过 `onTrigger` 尝试恢复路径；生产模式没有该信息，失效逻辑可退回顶层 key 全量处理。
3. 每次 watcher 回调调用 scheduler；scheduler 最终再次调用根 `renderer.render(schema, ctx)`。
4. `renderer.createVNode` 递归执行 cond/show、组件化判断、loop、attrs、children、slots、lifecycle 和装饰器。
5. 运行时 `h()` 没有模板编译器提供的 block tree/patch flag，Vue 只能执行通用 diff。

源码锚点：

- `packages/vario-vue/src/composables/internal/use-vario-phases.ts:233-268`
- `packages/vario-vue/src/renderer.ts:181-267`
- `packages/vario-vue/src/composables/internal/invalidation-controller.ts:28-120`

### 递归与静默截断

`renderer.createVNode` 递归进入 `childrenResolver.resolveChildren`。后者为每个 child 创建新 path 和 `nodeContext`，并在 `catch` 中直接返回 `null`。这会把 `RangeError: Maximum call stack size exceeded` 与普通子节点错误一起吞掉，最终让 `.filter()` 产生一棵“成功返回但缺失尾部”的 VNode 树。

源码锚点：`packages/vario-vue/src/features/children-resolver.ts:62-77`。

这比明确失败更危险：页面可能只在特殊深度或热栈状态下丢失底部字段，却没有 typed diagnostic，也没有可靠的错误边界。

### parentMap 的宽树成本

`registerParentMap` 在处理一个 child 时会重新遍历该 child 的全部 siblings 并写入 parentMap。对有 `bₚ` 个孩子的父节点，写入次数近似 `bₚ²`；1000 个同级节点的定向计数约为 1,003,003 次 `Map#set`。PreparedView 应在单次父节点扫描中一次性建立 parent/children index。

源码锚点：`packages/vario-vue/src/renderer.ts:274-285`。

### 当前“子树组件化”的实际边界

`shouldComponentize` 会递归统计后代，并以 scope boundary 与阈值 5 决定是否创建 `VarioNode`。但 `createVarioNodeVNode` 仍传入 schema、ctx、renderer、parentMap，以及每轮可能新建的 `modelPathStack` 和 `nodeContext`；`depth` 默认一直回到 0。Vue 看到不稳定引用后不能可靠跳过子组件。

源码锚点：

- `packages/vario-vue/src/features/vario-node.ts:94-128`
- `packages/vario-vue/src/features/vario-node.ts:137-170`
- `packages/vario-vue/src/features/vario-node.ts:310-333`

### loop 展开

每个 item 当前都会：

1. 浅克隆模板 Schema；
2. 删除 loop/model 并递归标记 loop path；
3. 创建 path stack、item path、node context；
4. 创建 loop context；
5. 为组件化 cell 传入多个新对象和闭包；
6. 再次递归 createVNode。

源码锚点：`packages/vario-vue/src/features/loop-handler.ts:103-178`。

因此嵌套 loop 的性能、内存和栈深均由展开后的 `R` 决定。只优化 Schema 静态遍历不能解决列表场景。

### lifecycle 与 render-time 副作用

- `LifecycleWrapper` 在 `createComponentWithLifecycle()` 每次调用时执行 `defineComponent()`，组件 type 身份随更新变化，普通状态更新即可造成卸载/重挂。
- `createModelBinding()` 会在 render 路径中写入默认 state；lazy model 每次创建本地 timer 和闭包。

源码锚点：

- `packages/vario-vue/src/features/lifecycle-wrapper.ts:36-73`
- `packages/vario-vue/src/bindings.ts:139-250`

这些行为必须在局部化之前修正，否则稳定组件边界会被副作用和身份变化破坏。

### expression cache 是移除 deep watch 的前置阻断

缓存条目的有效性检查只验证依赖路径“仍然存在”，并未记录依赖版本或值版本。值从 `1` 变成 `2` 时路径仍存在，结果可能被错误复用。因此，根 deep watch 虽然昂贵，目前仍承担粗粒度清缓存职责；必须先实现 `ExpressionPlan.dependencies + StateStore.pathVersion`。

源码锚点：`packages/vario-core/src/expression/cache.ts:50-68`。

## 深度与状态规模实测

### 方法

- Node.js 24.12，Vue v3.5.27，`NODE_ENV=production`。
- 使用 Vue custom renderer 执行真实组件 mount 和 mutation 后 update，不只调用 `renderer.render()`。
- 每个深度在独立进程运行，避免前一轮栈热度影响后一轮。
- 每个数据点 2 次预热、9 次采样；表中是中位数。
- 除耗时外，同时验证最深节点实际存在、更新后文本正确，失败记为失败而不是 `0ms`。
- 当前一次性深度探针尚未固化为仓库脚本；[Phase 0](./tasks/phase0-baseline-and-contracts.md) 会把它转成 CI 可复现 fixture。

### 单链深树：内联路径

| `D` | mount 中位数 | update 中位数 | 正确性 |
|---:|---:|---:|---|
| 20 | 0.249ms | 0.080ms | 9/9 |
| 50 | 0.317ms | 0.116ms | 9/9 |
| 100 | 0.356ms | 0.139ms | 9/9 |
| 200 | 0.455ms | 0.231ms | 9/9 |
| 500 | 0.827ms | 0.521ms | 9/9 |
| 800 | N/A | N/A | 0/9，mount RangeError |
| 1000 | N/A | N/A | 0/9，mount RangeError |

同一环境的细查断点：单独 mount 约为 `D=762/763`，完整 mount+update 约为 `D=649/650`。这些数字只说明当前路径的断裂方式，不是生产 SLA。

### 单链深树：强制每层 VarioNode

| `D` | mount 中位数 | update 中位数 | 正确性 |
|---:|---:|---:|---|
| 20 | 0.502ms | 0.250ms | 9/9 |
| 50 | 0.801ms | 0.480ms | 9/9 |
| 100 | 1.140ms | 0.821ms | 9/9 |
| 200 | 1.787ms | 1.398ms | 9/9 |
| 500 | N/A | N/A | mount RangeError |

细查断点约为 `D=359/360`。每层组件化显著增加组件栈与更新成本，没有解除递归。

### 单链深树：每层真实注册组件

| `D` | mount 中位数 | update 中位数 | 正确性 |
|---:|---:|---:|---|
| 20 | 0.558ms | 0.282ms | 9/9 |
| 50 | 0.783ms | 0.496ms | 9/9 |
| 100 | 1.214ms | 0.883ms | 9/9 |
| 200 | 2.172ms | 1.450ms | 9/9 |
| 500 | N/A | N/A | mount RangeError |

细查断点约为 `D=236/237`。真实业务组件还会有 setup、inject、slot、DOM 和组件库成本，因此这里仍是乐观下界。

### 无关状态图规模

固定 Schema `N=1`，只改变一个叶子，但 reactive state 中含不同数量的可遍历字段：

| `S` | 单次更新耗时 |
|---:|---:|
| 100 | 0.46ms |
| 1,000 | 2.57ms |
| 5,000 | 12.99ms |
| 10,000 | 27.32ms |
| 20,000 | 57.41ms |

结论：当前更新成本不仅依赖 `N`，还直接受整个状态图 `S` 影响；在大表单或多模块共享 state 中，无关字段也会进入 watcher 遍历。

### 组件 render 计数

- 单条组件链长度为 11、21、51、101、201；只有最深叶子读取变化值时，更新仍分别触发 11、21、51、101、201 个组件 render。
- 宽度 10/100/500/1000 且只有一个动态组件时，更新仍触发全部兄弟组件 render。

这证明问题不是“Vue 组件数量不够”，而是根 VNode 被重建且边界输入不稳定。目标应是稳定 root 与稳定区域 identity，让 Vue render effect 在真正读取依赖的区域内追踪。

## Vue 3 能力边界

本地 Vue v3.5.27 已提供 `effectScope`、`getCurrentScope`、`onScopeDispose`、`shallowRef`、`shallowReactive`、`markRaw`、`triggerRef` 与 `customRef`。最小探针确认：

- `shallowRef` 的深层原位修改不会触发 effect，替换 `.value` 会触发。
- `markRaw` 对象不会被深度代理。
- `effectScope().stop()` 会停止其内部 effect；3.5.x 还提供 pause/resume。

适用策略：

| 对象 | Vue 容器 | 理由 |
|---|---|---|
| `PreparedView` 根引用 | `shallowRef` | 只在 revision 替换时通知，不递归代理只读计划 |
| `PreparedNode` 与索引 | `markRaw` 或只读普通对象 | 编译后不可变，禁止运行时原位改写 |
| `RuntimeSession`/renderer/service | `markRaw` + provide/inject | 服务身份稳定，不应被 Vue 深代理 |
| node revision/signals | `shallowRef<number>` 或 `shallowReactive(Map)` | 只触发指定区域，不代理整份 plan |
| 业务 state | `reactive`/明确 refs | 必须保留深层业务响应性 |
| loop item | 保持其来源的响应性 | `markRaw` 会让 cell 内字段变化失联 |

当前包声明 Vue 开发依赖范围含 `^3.4`；如果 PageSession 使用 3.5 才有的 pause/resume，必须做版本决策或 feature detection。`effectScope.stop()` 可作为最低兼容基线，暂停能力可由订阅层实现，不能悄悄提高 peer 要求。

## 当前边界与目标复杂度

| 操作 | 当前 | 目标 |
|---|---|---|
| 首次 prepare | 多条递归/重复扫描 | `O(N)`，显式栈，调用栈 `O(1)` |
| 首次 mount | `O(Nrendered)` | `O(Nrendered)`，这是不可消除的物理成本 |
| 单叶状态更新 | `O(S + N + Σbₚ²)` + patch | `O(AΔ + dynamic work + dirty DOM)` |
| Schema 局部 patch | 深改不刷新或根替换全编译 | `O(Q + affected subtree + required ancestors)` |
| loop 单项更新 | 可重建整组 `R` | `O(cell subtree)` |
| 虚拟列表 | 仍按 `R` 构建 | `O(visible + overscan)` DOM/active cell |
| 页面销毁 | 依赖隐式组件 scope | 显式 `PageSession.dispose()` 清零资源 |

如果同一个 state 变化确实影响全部 `N` 个输出，那么 `O(N)` 是物理下界。局部化目标是消除“无依赖节点也随根重建”的额外工作，不承诺所有场景常数时间。

## 业界方案对比

这里比较的是可在当前代码库内落地的架构路径，不引用框架宣传数字。

| 方案 | 优点 | 主要问题 | 本项目适用性 |
|---|---|---|---|
| 调大 maxDepth 与缓存 | 改动最小 | 不消除递归、deep watch、全树 VNode 和静默截断 | 仅可作为临时诊断配置，不可作为目标 |
| 每个 Schema 节点一个 Vue 组件 | 直观、边界明确 | 组件栈/实例/props 成本随 N 增长；不稳定 props 仍全量 render | 不适合静态大树，只用于动态/有状态语义边界 |
| 一个根组件内手工 memo VNode | 组件少 | 依赖失效、slot/lifecycle/ref 很难正确，仍有根重建 | 可用于少量纯静态区域，不作为主模型 |
| PreparedView + 动态区域 | 结构只编译一次，更新按依赖区域传播 | 需要重做依赖版本、loop scope 和边界契约 | 推荐，能保持 public Facade 不变 |
| 自建 renderer 绕开 Vue | 可完全控制 diff | 失去 Vue 组件生态、生命周期、Teleport/KeepAlive/SSR 兼容 | 不符合真实 Vue 项目目标 |

## 研究限制

- 精细深度断点来自当前机器、当前 V8 栈和当前代码路径；换 Node、浏览器、开发模式或业务组件都会变化。
- custom renderer 能覆盖 Vue 组件 mount/update，但不包含浏览器 layout/paint；真实浏览器预算仍需 Playwright fixed-runner 基准。
- 状态规模探针使用规则对象结构，不代表所有 Proxy/getter/大型数组的成本；它足以证明渐进趋势。
- 一次性深度探针尚未作为仓库脚本提交，所以任务 Phase 0 要先固化原始 JSON、版本、正确性断言和运行协议。
- 当前工作树包含审计前已有改动；报告描述的是这份工作树，不代替已发布 npm 版本审计。

## 综合建议

**推荐方案**：在保持 `useVario` 及完整 public API surface 不变的前提下，实施“迭代式 PreparedView + Versioned StateStore + stable VarioRoot + 动态区域 + stable LoopCell + PageSession”。

关键顺序不可颠倒：先修复错误吞噬、lifecycle 身份和 render-time 写入；再建立依赖计划与版本；只有双轨结果证明无陈旧值后才移除根 deep watch；最后处理循环虚拟化、多页暂停、SSR 隔离和内存回收。具体模块契约见 [执行方案](./plans/README.md)，细颗粒实施顺序见 [阶段任务](./tasks/README.md)。

## 参考资料

### 项目源码

- `packages/vario-vue/src/composables/internal/use-vario-phases.ts`
- `packages/vario-vue/src/composables/internal/invalidation-controller.ts`
- `packages/vario-vue/src/renderer.ts`
- `packages/vario-vue/src/features/{children-resolver,vario-node,loop-handler,lifecycle-wrapper,attrs-builder}.ts`
- `packages/vario-vue/src/bindings.ts`
- `packages/vario-core/src/expression/cache.ts`
- `packages/vario-core/src/runtime/path.ts`
- `packages/vario-schema/src/validator.ts`
- `packages/vario-vue/__tests__/features/stress-test.test.ts`

### GitHub

- 仅使用当前仓库 `.github/workflows/` 判断现有 CI 是否包含真实深度、浏览器和内存门禁；远端资料 N/A。

### WebSearch

- N/A。按用户要求，性能与生产判断来自当前源码和本地执行，不用外部宣传数据替代。
