# ⚡ @variojs/core

Vario 核心运行时 - 指令虚拟机、表达式系统、运行时上下文

## 特点

- 🚀 **高性能**：表达式缓存、对象池、路径记忆化
- 🔒 **安全沙箱**：多层防护，白名单机制，防止恶意代码
- 📦 **框架无关**：可在任何 JavaScript 环境中使用
- 🎯 **扁平化状态**：`$` 前缀系统 API，简洁直观

## 安装

```bash
npm install @variojs/core
# 或
pnpm add @variojs/core
```

## 快速开始

```typescript
import { createRuntimeContext, createVMExecutor } from '@variojs/core'

// 创建运行时上下文
const ctx = createRuntimeContext({
  state: {
    count: 0,
    user: { name: 'John', age: 30 }
  },
  methods: {
    increment: (ctx) => {
      ctx._set('count', ctx._get('count') + 1)
    }
  }
})

// 访问状态（扁平化，无 models. 前缀）
ctx.count  // 0
ctx.user.name  // 'John'

// 使用系统 API
ctx._set('count', 10)
ctx.$emit('countChanged', 10)

// 执行指令
const executor = createVMExecutor(ctx)
await executor.execute({
  type: 'set',
  path: 'count',
  value: 10
})
```

## 表达式系统

安全、强大的表达式求值引擎：

```typescript
import { compileExpression, createExpressionSandbox } from '@variojs/core'

const sandbox = createExpressionSandbox(ctx)
const expr = compileExpression('count > 10 && user.age >= 18')
const result = expr.evaluate(sandbox)  // true/false
```

**支持的语法**：
- 变量访问：`count`, `user.name`
- 数组访问：`items[0]`
- 可选链：`user?.profile?.email`
- 运算：`count + 1`, `price * quantity`
- 逻辑：`showContent && isActive`
- 三元：`count > 10 ? "high" : "low"`
- 白名单函数：`Array.isArray`, `Math.max`

## 优势

- ✅ **类型安全**：完整的 TypeScript 类型定义
- ✅ **性能优化**：表达式缓存、路径缓存、对象池复用
- ✅ **安全可靠**：白名单机制，沙箱隔离，防止代码注入
- ✅ **易于扩展**：支持自定义指令和方法

## 许可证

MIT
