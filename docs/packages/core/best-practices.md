# @vario/core 最佳实践

## 1. 状态与 API 边界

- **状态**只通过 `_get` / `_set` 读写，便于统一走 `onStateChange`、做追踪或持久化。
- 业务逻辑尽量放在 **methods** 里，由 VM 的 `call` 触发，而不是在外部随意改 ctx 属性。

## 2. 表达式

- 尽量写**纯表达式**：只依赖当前上下文状态与白名单函数，避免依赖闭包或外部变量。
- 需要复杂逻辑时，用 **call** 调 methods，在方法里用 TypeScript 写，而不是在表达式里“拼逻辑”。
- 对来自配置或前端的表达式字符串，若有校验需求，先 **parseExpression** + **validateAST** 再求值。

## 3. Action 与 VM

- 事件回调里优先用 **batch** 把多步写状态/调方法合在一起，减少中间态和重复渲染。
- **loop** 的 `body` 保持简短，复杂逻辑放到 **call** 里。
- 生产环境务必给 **execute** 传 `timeout`、`maxSteps`，避免异常数据导致长时间卡死。

## 4. 路径与循环

- 路径尽量**事先校验**（在 Schema 层或业务层），避免运行时才因路径错误报错。
- 在渲染层或 VM 的循环中，**成对使用** createLoopContext / releaseLoopContext，利用池化减少分配。

## 5. 安全与性能配置

- **exprOptions** 中设好 `maxSteps`、`timeout`、`maxNestingDepth`，且不开启 `allowGlobals`。
- 若 Schema 在运行时动态变化，可周期或按路由 **invalidateCache** / **clearPathCache**，避免旧缓存占用过多内存。

## 6. 测试与复用

- Core 不依赖 DOM，**RuntimeContext + execute** 可在 Node 或 Vitest 中直接测，无需挂载 Vue。
- 同一份 Context 可用于多端（如 SSR、测试、脚本），只替换渲染层或 `onEmit` / `onStateChange` 的实现即可。
