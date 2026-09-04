# 性能基准、复杂度断点与容量判断

> 关联：[证据报告](./research-report.md) · [验收门禁](./acceptance-gates.md)

## 1. 先区分三种“渲染时间”

Vario 当前性能报告混用了不同阶段：

1. **Schema → VNode 构造**：纯 JS 对象工作。
2. **Vue component render/diff/patch**：Vue 组件执行与 host patch。
3. **浏览器 DOM/layout/paint**：真实用户可见成本。

只有第 1 项快，不能证明第 2、3 项快。本次浏览器基准至少执行 `createApp().mount()` 和真实 DOM update；Vue 子审计还用 custom renderer 记录组件 render 数，避免只看毫秒而看不到全量重算。

## 2. 环境与方法

| 项目 | 值 |
|---|---|
| OS | macOS Darwin 25.4.0 arm64 |
| Node | 24.12.0 |
| Vue | 3.5.27 |
| Browser | Headless Chrome 151 |
| 运行方式 | Vite dev server + Playwright CLI |
| 样本 | 初始 mount 每规模 5 次取中位数；动态更新 7～9 次取中位数 |

浏览器 harness：`output/playwright/vario-audit-benchmark.js`。

### 2.1 复现完整度

| 证据 | 当前可复现程度 | 进入 CI 前必须补齐 |
|---|---|---|
| Chrome mount/update/loop/deep/multi-page/canvas/lifecycle | 已保存可执行 harness，本文保存环境与汇总结果 | 保存每轮原始 JSON，使用 production bundle，固定 runner ID |
| Core 100→101 cache | 已用当前 dist 复跑两组探针，本文保存汇总数字 | 固化 99/100/101/500/2000 harness 与原始 JSON |
| Core loop × 父状态 | 已复跑 0/100/1000/5000 字段，本文保存汇总数字 | 固化独立进程、预热、p95 与复杂度断言 |
| Bundle/tree-shaking | 已用 esbuild 消费侧探针得到汇总数字 | 保存 entry/metafile/minified/gzip 原始产物与 budget script |
| Vue custom-renderer render counter | 已复跑并保存汇总数字 | 迁入仓库固定 fixture，与 browser DOM 正确性联合阻断 |
| Security/VM/Schema probes | [证据报告](./research-report.md#安全与正确性探针) 保存输入/输出摘要 | Phase 0 固化为 regression tests，不把手工摘要当长期门禁 |

因此，本文数据是可追溯的审计快照，**尚不是完整的固定 CI benchmark 套件**。Phase 0 必须固化所有 harness 与原始结果；采样、预热、GC 和 provisional budget 见 [验收门禁](./acceptance-gates.md#固定-runner-时间预算)。

核心方法：

```text
defineComponent.setup
  -> useVario(schema, { state })
  -> render function returns api.vnode.value
createApp(Root).mount(host)
await nextTick()
```

测试节点主要为原生 `div/span/input`。因此下列数据是**乐观下界**，真实 Element Plus、图表、slot、校验器和业务副作用只会增加成本。

## 3. 实际浏览器结果

### 3.1 静态平铺节点初始 mount

| 节点数 | 中位 mount |
|---:|---:|
| 100 | 0.7ms |
| 500 | 2.2ms |
| 1000 | 5.5ms |
| 2000 | 18.7ms |

这组结果说明简单初始构造本身并不慢，但 1000→2000 的增长已受 O(N²) parentMap 放大。源码计数进一步证明：1000 个 sibling 会产生约 1,003,003 次 WeakMap.set。

### 3.2 动态平铺节点：只改一个叶子

每个 span 绑定双花括号表达式 `values[index]`，只更新数组中一个值：

| 节点数 | 初始 mount | 单字段更新中位数 | DOM 正确 |
|---:|---:|---:|:---:|
| 100 | 5.3ms | 0.9ms | 是 |
| 500 | 5.4ms | 3.2ms | 是 |
| 1000 | 9.4ms | 8.8ms | 是 |

单个叶子变化随整页 N 线性增长，说明更新成本仍绑定整棵 Schema，而不是受影响节点数量。1000 个最简单节点已经消耗 8.8ms CPU 提交预算；换成真实组件后很容易跨过 16.7ms 一帧。

### 3.3 Loop 列表

每行 3 个动态 span，修改中间一行、再追加一行：

| 行数 | 初始 mount | 单项更新中位数 | append | 文本/更新正确 |
|---:|---:|---:|---:|:---:|
| 100 | 3.3ms | 1.5ms | 1.2ms | 否 |
| 500 | 6.4ms | 5.9ms | 5.6ms | 否 |
| 1000 | 11.4ms | 10.6ms | 10.3ms | 否 |

DOM 行数会增长到 101/501/1001，但 `itemKey/indexKey` 别名文本为空，更新文本也不出现。当前数据只能用来说明全量增长，不能宣称功能可用。

Vue custom renderer 的 render counter 更直接：修改一项时 100/500/1000 个 `LoopItemCell` 全部 render，耗时约 8.3/27.7/48.6ms，尚未包含浏览器 DOM/layout。

### 3.4 深嵌套

单链原生 DOM：

| 深度 | 初始 mount | 单叶子更新 | 结果 |
|---:|---:|---:|:---:|
| 20 | <0.1ms | 0.1ms | 正确 |
| 50 | 0.2ms | <0.1ms | 正确 |
| 100 | 0.2ms | 0.1ms | 正确 |
| 200 | 0.3ms | 0.2ms | 正确 |

结论不是“任意深度都安全”：

- custom renderer 到约 1000 层会 `RangeError`。
- Core Schema DFS 到 5000 层会栈溢出。
- model 状态路径超过 20 段会静默写失败。
- validator 默认允许 Schema 深度 100，但 render、query、model 的上限不一致。

宽度是当前性能主风险，深度则是正确性与栈安全风险。

进一步用 Vue v3.5.27 production custom renderer 对每个深度独立进程采样，并校验最深 VNode 与更新结果后，得到三条不同断点：

| 模式 | D=20 mount/update | D=100 mount/update | D=200 mount/update | 当前环境断点 |
|---|---:|---:|---:|---|
| 默认 inline | 0.249/0.080ms | 0.356/0.139ms | 0.455/0.231ms | mount+update 约 649/650 |
| 每层强制 VarioNode | 0.502/0.250ms | 1.140/0.821ms | 1.787/1.398ms | 约 359/360 |
| 每层真实注册组件 | 0.558/0.282ms | 1.214/0.883ms | 2.172/1.450ms | 约 236/237 |

断点只适用于当前 V8 栈和代码路径，不是产品 SLA。它证明“每节点组件化”会增加组件栈和实例成本，不能解决任意 N 层；更严重的是 `children-resolver` 当前会捕获递归异常后返回 `null`，部分深度可能生成缺失尾部的 UI 而非明确失败。

固定 Schema `N=1`、只更新一个叶子时，无关 state 图规模仍显著影响更新：

| state 规模 `S` | 更新耗时 |
|---:|---:|
| 100 | 0.46ms |
| 1,000 | 2.57ms |
| 5,000 | 12.99ms |
| 10,000 | 27.32ms |
| 20,000 | 57.41ms |

因此当前更新成本同时受 `S` 与 `N` 支配。完整调用链、实测限制、Vue 3 shallow/markRaw/effectScope 使用边界和细颗粒任务见 [Vue 3 深层渲染专项](./vue3-deep-runtime/research-report.md)。专项采用“正常页面建议 `D≤50`、必须验证 `D=100`、超限 mount 前 typed diagnostic”；compiler 的 10,000 层门禁只验证显式栈，不授权 10,000 层 DOM。

### 3.5 多页面同时驻留

每个页面 200 个动态 span，各自独立 `useVario`：

| 页面数 | DOM 元素 | 初始 mount | 更新一个页面 |
|---:|---:|---:|---:|
| 5 | 1011 | 5.4ms | 1.1ms |
| 10 | 2021 | 9.8ms | 1.2ms |
| 20 | 4041 | 20.8ms | 1.4ms |

这证明简单多实例能运行，也证明初始成本和 DOM 内存随页面数线性叠加。它不能消除以下结构风险：每页有完整 deep watcher/cache/renderer；model config 是全局 Map；loop pool 可保留 parent context；没有 pause/deactivate/evict/dispose 预算。

### 3.6 画布与生命周期正确性

| 探针 | 实际结果 |
|---|---|
| 修改 `schema.children[0].children` | DOM 仍是 `before` |
| 替换根 Schema 引用 | DOM 更新为 `root-replaced` |
| lifecycle 节点更新一次 state | mounted=2、unmounted=1 |

画布原位编辑失效和组件重挂不是性能问题，而是生产阻断的正确性问题。

## 4. Core 算法断点

### 4.1 100→101 唯一表达式 cliff

结果缓存固定每 Context 100 条：`packages/vario-core/src/expression/cache.ts:26-33`。工作集满时，每次插入扫描全部条目找 oldest；miss 又重新 parse/validate/extract dependencies。

两组独立探针得到同一结论：

| 工作集 | 单次平均或总耗时 | 相对变化 |
|---:|---:|---:|
| 100 unique | 0.505µs/eval；100轮约2.85ms | 基线 |
| 101 unique | 8.503µs/eval；100轮约68.97ms | 约16.8～24倍 |
| 200 unique | 4.538µs/eval | 持续冷路径 |
| 500 unique | 4.022µs/eval | 持续冷路径 |

现有 `performance.test.ts` 恰好只测到 100 个唯一表达式，避开了真实断点。

### 4.2 Loop × 大状态

Core VM 5000 次空 body loop，仅增加父 Context 顶层字段：

| 父状态字段 | 耗时 |
|---:|---:|
| 0 | 49.31ms |
| 100 | 280.17ms |
| 1000 | 2159.56ms |
| 5000 | 6231.95ms |

根因是 `releaseLoopContext` 的 `for...in` 枚举继承字段，复杂度 O(L×K)，不是 body 业务逻辑。

### 4.3 Cache 全清抖动

- path cache：2000 条时 `clear()` 全部，`runtime/path.ts:137-141`。
- compiled expression cache：2000 条时 `clear()` 全部，`expression/compiler.ts:167-170`。

多页面、动态 model path、高基数表达式会周期性同时进入冷路径。应使用真正 LRU/分代与字节预算，而不是固定条数到点清空。

## 5. Bundle 体积

包自身 minified dist 看起来较小：

| 包 | raw | gzip |
|---|---:|---:|
| core | 33.1KB | 9.6KB |
| schema | 9.4KB | 3.2KB |
| vue | 36.9KB | 12.3KB |

但 Core dist 同步保留 `import '@babel/parser'`，消费应用必须把 parser 打包进去。消费侧 esbuild 探针：

| 导入 | minified | gzip |
|---|---:|---:|
| 根入口仅 `getPathValue` | 308.0KB | 79.6KB |
| `validateSchema` | 317.0KB | 82.6KB |
| 完整 `useVario`，Vue external | 374.1KB | 99.2KB |

根入口 tree-shaking 没有隔离 parser 副作用。目标应拆 `./runtime`、`./expression`、`./vm`、`./schema-tools` 子入口，并让 CLI/Worker 预编译表达式；根入口继续兼容重导出。

## 6. 为什么现有 benchmark 不能证明生产性能

现有测试普遍：

```text
useVario(schema)
await nextTick()
expect(vnode.value).toBeDefined()
```

没有 mount，也没有执行测试里定义的“模拟 Element Plus 组件”。证据：

- `packages/vario-vue/__tests__/performance.test.ts:21-70`
- `packages/vario-vue/__tests__/comprehensive-perf-report.test.ts:298-359`
- Playground 的大节点计时结束后只预览前 100/200 个：`play/src/views/PerformanceTests.vue:588-635,1002-1043`

综合测试还有两类方法误差：

- 每轮在组件作用域外新建 useVario/watch，未显式 dispose，样本间资源累积。
- 单项更新使用 `Date.now()` 造值；同一毫秒重复时 Vue 认为值未变化，出现 0.002ms 之类假快结果。

因此原有数据可以保留为 Schema→VNode 微基准，但必须改名，不能标为 Vue 页面渲染性能。

## 7. 从简单到复杂的当前容量结论

| 级别 | 典型规模 | 当前判断 |
|---|---|---|
| S0 简单 | ≤200 节点、≤80 unique expr、loop≤100 | 修 P0 后可用；应保持 Schema 可信 |
| S1 中等 | 200～1000 节点、100～500 expr | 能运行但更新线性；仅适合低频后台页 |
| S2 复杂 | 1000～5000 节点、多个 loop/slot/model | 不建议；一项更新可能跨帧，全局 cache 抖动 |
| S3 画布 | 高频 Schema patch、选择/拖拽/撤销 | 不可用；缺稳定 ID、增量编译、真实 patch |
| S4 多页面 | 10+ 驻留页、共享物料/状态 | 不具备资源治理；只可做简单静态验证 |
| S5 不可信租户 | 用户表达式/action/path | 禁止；安全边界已被实证突破 |

## 8. 需要进入 CI 的性能指标

不再只记录平均毫秒，至少同时记录：

- prepare/compile/mount/update 的 p50/p95/p99。
- 单字段更新触发的 node render 数和 loop cell render 数。
- parentMap/index 操作次数，防止 O(N²) 回归。
- DOM 元素数与组件实例数。
- expression plan cache 的 hit/miss/evict 与 99/100/101/500/2000 边界。
- PageSession 创建/暂停/恢复/销毁后的 heap retained size。
- 主线程 >50ms long task 数和浏览器 INP。

具体预算见 [验收门禁](./acceptance-gates.md)。
