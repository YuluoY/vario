# 调研与证据报告

> 日期：2026-08-31  
> 作者：huyongle  
> 状态：已完成  
> 关联：[审计范围](./spec.md) · [性能基准](./performance-benchmarks.md)

## 调研目标

- 还原 Schema 从输入到 Vue DOM 的真实调用链。
- 定位简单、宽树、深树、循环、状态更新和多页面的复杂度断点。
- 验证 Schema 契约、安全沙箱、VM 限制与生命周期是否符合注释承诺。
- 判断现有测试是否测到了真实 Vue mount/patch，而非只测对象构造。
- 形成不改变公共调用方式的目标架构。

## 知识缺口与结论

| 编号 | 知识缺口 | 调研深度 | 信息源 | 结论 | 可信度 |
|---|---|---:|---|---|---|
| KG-1 | 状态更新是否局部渲染 | L3 | Vue/Core 源码、Chrome、render counter | 主调度仍重建整棵 VNode；loop 单项更新随 N 线性增长 | 高 |
| KG-2 | 画布原位编辑是否刷新 | L3 | Vue 源码、Chrome、DOM 断言 | 深层原位修改不刷新；替换根引用才刷新 | 高 |
| KG-3 | 循环别名与事件是否正确 | L3 | Core/Vue 单测、Chrome、求值调用链 | 当前工作树别名求值失败，Core/Vue 均有回归 | 高 |
| KG-4 | lifecycle 是否稳定 | L3 | Vue 源码、Chrome、钩子计数 | 普通状态更新会卸载并重新挂载 wrapper | 高 |
| KG-5 | VM 限制是否覆盖嵌套 | L3 | VM 源码、Node 探针、延迟副作用断言 | if/loop/batch 重新创建执行器，重置 maxSteps/timeout | 高 |
| KG-6 | Schema 是否可视为不可信输入 | L3 | path/evaluator 源码、Node 探针、污染后全局断言 | 不能；路径可污染原型，表达式可调用有副作用方法 | 高 |
| KG-7 | 类型/验证/规范化是否同构 | L3 | Types/Schema 源码、Node 探针、fixture matrix | 不同构；合法事件被拒、未知 action 被放行、扩展字段被丢弃 | 高 |
| KG-8 | 多页面资源是否隔离 | L3 | Core/Vue 源码、Chrome、DOM 驻留计数 | 小规模可挂载，但注册表和 loop pool 全局，缺少暂停/销毁预算 | 高 |
| KG-9 | 现有性能报告是否可采信 | L3 | 测试源码、复跑、真实 Chrome mount | 只构造 VNode，未 mount 组件和 DOM；部分数据受重复赋值影响 | 高 |
| KG-10 | 发布包是否等于当前源码 | L3 | build/CI/CLI 源码、本地命令、bin 探针 | 无保证；bin 不执行、CI 缺测试、发布可复用旧 dist | 高 |

## 信息源说明

用户明确要求结论来自代码逻辑，不采用文档宣称。因此本次核心结论采用以下互相校验的本地证据：

1. **L1 源码**：逐层追踪 `types → core → schema → vue/cli`。
2. **L2 自动测试**：运行现有 unit/integration/lint/build，并检查测试方法是否覆盖真实行为。
3. **L2 定向探针**：用公开 API 复现原型污染、嵌套 maxSteps、超时后副作用、validator/normalizer 契约。
4. **L2 真实浏览器**：在 Chrome 中实际 `createApp().mount()`，测 DOM mount/update 与多页面驻留。

外部文档、博客、README 和原有 benchmark 报告不作为判断依据。

## 关键调用链锚点

| 链路 | 源码锚点 |
|---|---|
| `useVario` 组装 | `packages/vario-vue/src/composable.ts:94-154` |
| Vue 状态监听与全树调度 | `packages/vario-vue/src/composables/internal/use-vario-phases.ts:233-268` |
| Schema → VNode 主管线 | `packages/vario-vue/src/renderer.ts:195-268` |
| loop 展开 | `packages/vario-vue/src/features/loop-handler.ts:51-186` |
| lifecycle wrapper | `packages/vario-vue/src/features/lifecycle-wrapper.ts:36-73` |
| RuntimeContext `_get/_set` | `packages/vario-core/src/runtime/create-context.ts:62-106` |
| 表达式 parse/validate/evaluate/cache | `packages/vario-core/src/expression/evaluate.ts:33-95` |
| Action 执行 | `packages/vario-core/src/vm/executor.ts:38-145` |
| Schema 验证 | `packages/vario-schema/src/validator.ts:48-241` |
| Schema 规范化 | `packages/vario-schema/src/normalizer.ts:30-114` |

## 实际执行命令与结果

### 项目门禁

```bash
pnpm test
pnpm --filter @variojs/vue test
pnpm test:integration
pnpm --filter @variojs/cli test
pnpm lint
pnpm build
pnpm --filter ./play build
```

| 门禁 | 结果 |
|---|---|
| Core unit | 217/218 通过；loop 简单别名失败 |
| Vue unit | 329/337 通过；8 个 todo-loop 用例失败 |
| Schema unit | 35/35 通过 |
| CLI unit | 6/6 通过，但没有 bin smoke test |
| Integration | 42/42 通过，但出现 Vue render-context warning，且配置指向旧包名/dist |
| Lint | 2 errors、5 warnings |
| 包构建 | 通过，约 6.44s；构建脚本出现 `shell:true` 参数安全弃用警告 |
| Playground build | 通过，约 25.56s |

### 安全与正确性探针

```text
setPathValue({}, '__proto__.varioPolluted', 'yes')
=> ({}).varioPolluted === 'yes'

execute(loop(...), ctx, { maxSteps: 1 })
=> 20 次 body 仍全部执行

execute(call slow, { timeout: 10 })
=> 10ms 报 ACTION_TIMEOUT；70ms 后 slow 仍把 done 写为 true

ctx._set(21 段路径, 1)
=> 读取 undefined，但 onStateChange 仍触发一次
```

### Schema 契约探针

```text
事件 action object / method string / string[] / tuple
=> 类型允许，validator 拒绝

[{ type: 'unknown' }]
=> validator 判 valid

normalizeSchema({ directives, ref, teleport, onMounted, provide, meta, model.default/lazy })
=> 只剩 { type, model.path }
```

### 浏览器基准

基准脚本：`output/playwright/vario-audit-benchmark.js`。完整方法和结果见 [性能基准](./performance-benchmarks.md)。关键结果：

- 100/500/1000 动态节点单字段更新中位数：0.9/3.2/8.8ms。
- loop 100/500/1000 行单项更新中位数：1.5/5.9/10.6ms，且文本正确性全部失败。
- 5/10/20 页 × 每页 200 节点初始 mount：5.4/9.8/20.8ms。
- Schema 深层原位修改后 DOM 仍为 `before`；根替换后才变为 `root-replaced`。
- lifecycle 节点一次状态更新后 mounted=2、unmounted=1。

## 已知研究限制

- Headless Chrome 数字不能代表低端移动设备。
- 浏览器基准使用原生 DOM 节点，未加入 Element Plus、图表或富文本成本，因此是偏乐观下界。
- 多页面基准测到 20 页 × 200 节点，没有形成长期 8 小时内存曲线；内存结论主要来自全局引用源码与生命周期探针。
- 当前工作树包含审计前已有改动，失败结果描述的是当前可发布状态，不等价于某个历史 npm 版本。

## 综合建议

推荐方案是“**兼容外观 + 编译计划 + Session Runtime + Vue 稳定组件边界**”。首先以 characterization 测试和 P0 修复建立安全网，再将 Schema 结构编译与 State 更新分离，最后对画布、多页面和不可信 Schema 分别准入。只做零散缓存优化不能修复契约、安全、更新粒度和多页面生命周期；全量重写则缺少回归安全网。具体选型见 [目标架构](./target-architecture.md)。

## 参考资料

### 项目源码

- `packages/*/src`、`packages/*/__tests__`、`tests/integration`、`scripts/` 与 `.github/workflows/`。
- 浏览器探针：`output/playwright/vario-audit-benchmark.js`。

### GitHub

- 仅使用当前仓库中的 `.github/workflows/` 作为本地发布链证据；远端 GitHub 资料 N/A。

### WebSearch

- N/A。核心结论按用户要求来自当前源码与本地实验。
