# Vue 3 深层运行时 总结复盘

> 日期: 2026-09-01 | 作者: huyongle | 关联: [spec.md](./spec.md) | [验收报告](./verification-report.md)

## 基本数据

| 指标 | 计划 | 实际 | 偏差 |
|------|------|------|------|
| 开发工时 | 176h 净实施 | 远超单次会话 | 多轮返工 |
| 代码行数 | - | 工作树未提交大面积实现 | - |
| 文件变更数 | - | 远超单任务 | - |
| 引入 Bug 数 | - | vnode 对象缓存破坏 AC-13 | - |
| 返工次数 | - | MEM-2 / LoopItemCell / vnode.memo 多次 | - |

## What Went Well（做得好的）

- ✅ 默认 runtime 保持 `legacy`，调用方仍是 `useVario` / `defineSchema` / `execute`。
- ✅ Chrome PERF-T1～T6、SSR-2、相对 empty 的 MEM-2 对照有原始 JSON。
- ✅ AC-13 用稳定 `vnode.key` + 新 vnode（不回收已挂载对象）保住组件本地状态。

## What Could Be Better（可以更好的）

- 🔧 把已 patch 的 vnode 放进 Map 再按 key 重排，会被 Vue 当成卸载+重挂，本地状态归零。
- 🔧 `vnode.memo` 是 Vue 编译器字段，不能当业务缓存槽。
- 🔧 MEM-2 的 usedSize 斜率含 Vue/V8/Playwright 基线；必须先采 empty 再比 vario。
- 🔧 文档 checkbox 不能用“代码里有文件”代替门禁 JSON。

## Lessons Learned（学到的经验）

- 💡 列表身份保活靠 Vue keyed patch，不要复用已挂载 vnode 对象。
- 💡 heap 门禁要有空挂载对照，否则 20KB/round 无法判断归属。
- 💡 未通过项必须在 verification 里保持未勾选，并写原因。

## Action Items（改进措施）

| 编号 | 措施 | 类型 | 负责人 | 截止日期 |
|------|------|------|--------|---------|
| AI-1 | 补 AC-15 legacy/prepared 全 feature golden | 代码 | 运行时 | 生产切流前 |
| AI-2 | PERF-D3 补 60Hz drag+layout+paint trace | 代码 | 画布 | G6 前 |
| AI-3 | PERF-D4 真实应用 INP | 流程 | 应用侧 | G6 前 |
| AI-4 | 绝对 heap 零增长若要宣称，需先剥离 hist WeakRef 探针 | 代码 | 运行时 | 宣称 MEM-2 绝对通过前 |

## AI 执行反思（AI 专用）

### 这次执行中 AI 做得好的

- 用 emptySlope 对照而不是宣称 usedSize 零增长。
- AC-13 失败后用 cache hit 日志证明是 vnode 回收而非 key 解析错误。

### 这次执行中 AI 犯的错

- 用 `vnode.memo` 和回收 vnode 对象优化 MEM-2，直接打穿 AC-13。
- 多次把 GateGuard 当成新建文件拦截，减慢已有文件修补。

### 对后续 AI 执行的建议

- 列表热路径先保证 keyed 新 vnode，再谈跳过 `renderLoopItem`。
- 任何 heap 数字同时写 empty 对照与业务探针（items/ses/cells）。
