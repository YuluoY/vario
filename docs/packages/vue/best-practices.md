# @vario/vue 最佳实践

## 1. 状态与 Schema 一一对应

- state 的结构和 Schema 里 **model**、**{{ }}**、**cond**、**show**、**loop.items** 用到的路径保持一致，避免“路径写了但 state 里没有”或类型对不上。
- 用 **defineSchema** 或 **InferStateType** 从 Schema/view 推导状态类型，再作为 useVario 的 state 类型，减少重复定义。

## 2. model 与路径

- **容器**用 `model: { path: 'form', scope: true }`，不在容器上绑 v-model；**叶子**用 `model: 'fieldName'` 或完整路径。
- 状态未初始化时可用 **默认值**：`model: { path: 'name', default: '张三' }`，会写回状态。
- 循环用 `model: { path: 'list', scope: true }` + 子节点扁平路径，或循环内需要绑定“当前项本身”时用 `model: '.'`。
- 数组下标尽量用 **[]** 写法（如 `items[0].name`），语义更清晰，也和 Core 路径解析一致。

## 3. 事件与 methods

- 事件里多步操作用 **batch** 或在一个 method 里完成，避免中间态触发多余渲染。
- 把“可复用的业务逻辑”放在 methods，Schema 里只做 **call**；不在表达式里写长逻辑。

## 4. 表达式

- 只写读状态 + 简单运算 + 白名单函数；复杂展示用 **computed** 在组件里算好，再通过 useVario 的 **computed** 选项注入到 Schema 里用 `{{ computedName }}` 引用。

## 5. 大列表与性能

- 超过几百条的列表优先考虑**虚拟滚动**或分页，而不是一次渲染整棵 Schema 子树。
- 控制嵌套深度（例如 3～4 层以内），过深的树会加重递归与依赖收集。
- 若同一份 Schema 会多次实例化，尽量在“上层”做一次 **normalizeSchema**，再传进 useVario，减少重复计算。

## 6. 与 defineSchema 配合

- 用 **view.schema** 作为 useVario 的第一个参数，**view 的 state** 作为初始 state，**view 的 services** 映射到 methods（若框架支持），类型用 **InferStateType\<typeof view\>**，保证类型与运行时一致，并便于在测试、文档、低代码平台里复用同一份定义。

## 7. 错误与边界

- 对来自配置或远端的 Schema，在传入 useVario 前做 **validateSchema**，避免运行时在渲染中途抛错。
- 启用 **errorBoundary** 时提供有意义的 fallback，并在 onStateChange / 日志中记录错误，便于排查。

## 8. 可维护性

- 大 Schema 按“区块”拆成多个对象或函数，用 **children** 组合；或使用 defineSchema 的 schema 函数按 ctx 状态分支返回不同子树。
- 组件名（type）与项目内组件注册名、文档保持一致，方便搜索和重构。
