# 错误处理

Vario 提供了完善的错误处理机制，包括错误边界、错误分类、错误恢复等功能。

## 错误边界

Vario 默认启用错误边界，可以捕获渲染过程中的错误，防止整个应用崩溃。

### 基本用法

```typescript
import { useVario } from '@variojs/vue'

const { vnode, error, retry } = useVario(schema, {
  errorBoundary: {
    enabled: true,  // 默认为 true
    fallback: (error) => h('div', { class: 'error' }, [
      h('h3', '出错了'),
      h('p', error.message),
      h('button', { onClick: retry }, '重试')
    ]),
    onRecover: (error) => {
      console.log('从错误中恢复:', error)
    }
  }
})
```

### 配置选项

#### enabled

是否启用错误边界（默认 `true`）。

```typescript
useVario(schema, {
  errorBoundary: {
    enabled: false  // 禁用错误边界
  }
})
```

#### fallback

自定义错误显示组件。接收错误对象，返回 VNode。

```typescript
useVario(schema, {
  errorBoundary: {
    fallback: (error) => {
      return h('div', {
        style: {
          padding: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px'
        }
      }, [
        h('h3', { style: { color: '#c00' } }, '❌ 渲染错误'),
        h('p', error.message),
        h('pre', { style: { fontSize: '12px', overflow: 'auto' } }, error.stack),
        h('button', { 
          onClick: () => window.location.reload()
        }, '刷新页面')
      ])
    }
  }
})
```

#### onRecover

错误恢复回调。当错误被修复后调用。

```typescript
useVario(schema, {
  errorBoundary: {
    onRecover: (error) => {
      // 记录错误恢复
      console.log('Error recovered:', error)
      
      // 发送统计
      analytics.track('error_recovered', {
        message: error.message,
        timestamp: Date.now()
      })
    }
  }
})
```

### 错误恢复

使用 `retry()` 方法手动触发重新渲染：

```typescript
const { vnode, error, retry } = useVario(schema)

// 在模板中
h('template', [
  error.value 
    ? h('div', [
        h('p', error.value.message),
        h('button', { onClick: retry }, '重试')
      ])
    : vnode.value
])
```

## 错误类型

Vario 定义了多种错误类型（来自 @variojs/core）。

### VarioError

所有 Vario 错误的基类。

```typescript
class VarioError extends Error {
  code: ErrorCode
  context?: ErrorContext
  
  constructor(code: ErrorCode, message: string, context?: ErrorContext)
}
```

### ExpressionError

表达式求值错误。

```typescript
class ExpressionError extends VarioError {
  constructor(message: string, context?: {
    expression?: string
    path?: string
    state?: Record<string, unknown>
  })
}
```

**示例**：

```typescript
// 表达式语法错误
const schema = {
  type: 'div',
  props: {
    text: '{{ user.name }}'  // 如果 user 未定义
  }
}

try {
  useVario(schema, {
    state: {}  // user 不存在
  })
} catch (error) {
  if (error instanceof ExpressionError) {
    console.error('表达式错误:', error.message)
    console.error('表达式:', error.context?.expression)
  }
}
```

### ActionError

动作执行错误。

```typescript
class ActionError extends VarioError {
  constructor(message: string, context?: {
    action?: Action
    path?: string
  })
}
```

**示例**：

```typescript
const schema = {
  type: 'button',
  events: {
    click: {
      type: 'call',
      method: 'nonExistentMethod'  // 方法不存在
    }
  }
}

useVario(schema, {
  onError: (error) => {
    if (error instanceof ActionError) {
      console.error('动作执行失败:', error.message)
      console.error('动作:', error.context?.action)
    }
  }
})
```

### ServiceError

服务调用错误。

```typescript
class ServiceError extends VarioError {
  constructor(message: string, context?: {
    service?: string
    method?: string
    params?: unknown
  })
}
```

### BatchError

批量操作错误（包含多个子错误）。

```typescript
class BatchError extends VarioError {
  errors: Error[]
  
  constructor(message: string, errors: Error[])
}
```

## 错误码

```typescript
enum ErrorCodes {
  // 表达式错误 (1xxx)
  EXPRESSION_SYNTAX_ERROR = 1001,
  EXPRESSION_EVAL_ERROR = 1002,
  EXPRESSION_UNSAFE_ACCESS = 1003,
  
  // 动作错误 (2xxx)
  ACTION_INVALID_TYPE = 2001,
  ACTION_EXECUTION_ERROR = 2002,
  ACTION_METHOD_NOT_FOUND = 2003,
  
  // 服务错误 (3xxx)
  SERVICE_NOT_FOUND = 3001,
  SERVICE_CALL_ERROR = 3002,
  
  // Schema 错误 (4xxx)
  SCHEMA_VALIDATION_ERROR = 4001,
  SCHEMA_INVALID_NODE = 4002,
  
  // 运行时错误 (5xxx)
  RUNTIME_STATE_ERROR = 5001,
  RUNTIME_PATH_ERROR = 5002,
  
  // 批量错误 (6xxx)
  BATCH_ERROR = 6001
}
```

## 错误处理策略

### 1. 全局错误处理

使用 `onError` 回调处理所有错误：

```typescript
useVario(schema, {
  onError: (error) => {
    console.error('Vario Error:', error)
    
    // 发送错误报告
    if (error instanceof VarioError) {
      reportError({
        code: error.code,
        message: error.message,
        context: error.context,
        stack: error.stack
      })
    }
    
    // 显示用户友好的提示
    if (error instanceof ExpressionError) {
      showToast('数据加载失败，请稍后重试')
    } else if (error instanceof ActionError) {
      showToast('操作失败，请重试')
    }
  }
})
```

### 2. 错误边界 + 降级UI

结合错误边界和降级UI提供更好的用户体验：

```typescript
useVario(schema, {
  errorBoundary: {
    enabled: true,
    fallback: (error) => {
      // 根据错误类型显示不同的降级UI
      if (error instanceof ExpressionError) {
        return h('div', { class: 'error-placeholder' }, [
          h('p', '⚠️ 数据加载失败'),
          h('button', { onClick: retry }, '重新加载')
        ])
      }
      
      if (error instanceof ActionError) {
        return h('div', { class: 'error-placeholder' }, [
          h('p', '⚠️ 操作失败'),
          h('p', { class: 'error-hint' }, '请检查网络连接后重试')
        ])
      }
      
      // 默认错误UI
      return h('div', { class: 'error-fallback' }, [
        h('p', '出现了一些问题'),
        h('button', { onClick: () => window.location.reload() }, '刷新页面')
      ])
    }
  }
})
```

### 3. 方法级错误处理

在 methods 中捕获和处理错误：

```typescript
useVario(schema, {
  methods: {
    async fetchData: async ({ state }) => {
      try {
        const data = await api.fetchData()
        state.data = data
      } catch (error) {
        console.error('Fetch error:', error)
        state.error = error.message
        state.loading = false
      }
    },
    
    handleSubmit: ({ state, params }) => {
      try {
        // 验证
        if (!state.form.name) {
          throw new Error('姓名不能为空')
        }
        
        // 提交
        api.submit(state.form)
      } catch (error) {
        state.submitError = error.message
      }
    }
  }
})
```

### 4. Try-Catch 包装

对可能出错的表达式使用 try-catch：

```typescript
const schema = {
  type: 'div',
  props: {
    // 使用可选链避免错误
    text: '{{ user?.name ?? "未知用户" }}'
  },
  children: [{
    type: 'span',
    // 使用默认值
    children: '{{ items?.length ?? 0 }}'
  }]
}
```

## 错误监控集成

### Sentry 集成

```typescript
import * as Sentry from '@sentry/vue'

useVario(schema, {
  onError: (error) => {
    Sentry.captureException(error, {
      tags: {
        source: 'vario'
      },
      contexts: {
        vario: {
          code: error instanceof VarioError ? error.code : undefined,
          context: error instanceof VarioError ? error.context : undefined
        }
      }
    })
  }
})
```

### 自定义错误追踪

```typescript
const errorTracker = {
  errors: [] as Error[],
  
  track(error: Error) {
    this.errors.push(error)
    
    // 发送到后端
    fetch('/api/errors', {
      method: 'POST',
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      })
    })
  }
}

useVario(schema, {
  onError: (error) => {
    errorTracker.track(error)
  }
})
```

## 调试技巧

### 1. 启用详细错误信息

```typescript
useVario(schema, {
  exprOptions: {
    // 启用详细的表达式错误信息
    throwOnError: true
  },
  onError: (error) => {
    console.group('❌ Vario Error')
    console.error('Type:', error.constructor.name)
    console.error('Message:', error.message)
    console.error('Code:', error instanceof VarioError ? error.code : 'N/A')
    console.error('Context:', error instanceof VarioError ? error.context : 'N/A')
    console.error('Stack:', error.stack)
    console.groupEnd()
  }
})
```

### 2. 错误边界开发模式

```typescript
const isDev = import.meta.env.DEV

useVario(schema, {
  errorBoundary: {
    enabled: true,
    fallback: (error) => {
      if (isDev) {
        // 开发模式：显示详细错误信息
        return h('div', { class: 'dev-error' }, [
          h('h3', '🐛 Development Error'),
          h('pre', { style: { whiteSpace: 'pre-wrap' } }, error.stack),
          h('details', [
            h('summary', 'Error Context'),
            h('pre', JSON.stringify(
              error instanceof VarioError ? error.context : {}, 
              null, 
              2
            ))
          ])
        ])
      } else {
        // 生产模式：显示用户友好的错误
        return h('div', { class: 'error' }, [
          h('p', '抱歉，出现了一些问题'),
          h('button', { onClick: retry }, '重试')
        ])
      }
    }
  }
})
```

### 3. 错误日志

```typescript
const errorLog = {
  log(error: Error) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: error.constructor.name,
      message: error.message,
      code: error instanceof VarioError ? error.code : undefined,
      context: error instanceof VarioError ? error.context : undefined,
      stack: error.stack
    }
    
    console.table(entry)
    
    // 保存到 localStorage（开发用）
    const logs = JSON.parse(localStorage.getItem('vario_error_log') || '[]')
    logs.push(entry)
    localStorage.setItem('vario_error_log', JSON.stringify(logs.slice(-100)))
  }
}

useVario(schema, {
  onError: errorLog.log
})
```

## 最佳实践

1. **始终配置 errorBoundary**：防止单个错误导致整个应用崩溃
2. **提供有意义的错误消息**：帮助用户理解发生了什么
3. **实现错误恢复机制**：允许用户重试或返回安全状态
4. **记录错误日志**：便于追踪和修复问题
5. **区分开发和生产环境**：开发时显示详细信息，生产时显示友好提示
6. **使用错误监控服务**：及时发现和解决线上问题
7. **测试错误场景**：确保错误处理逻辑正常工作

## 常见错误场景

### 1. 表达式错误

```typescript
// ❌ 错误：访问未定义的属性
const schema = {
  type: 'div',
  children: '{{ user.name }}'  // user 未定义
}

// ✅ 正确：使用可选链
const schema = {
  type: 'div',
  children: '{{ user?.name ?? "Guest" }}'
}
```

### 2. 方法未找到

```typescript
// ❌ 错误：方法不存在
const schema = {
  type: 'button',
  events: {
    click: 'handleClick'  // 方法未定义
  }
}

// ✅ 正确：定义方法
useVario(schema, {
  methods: {
    handleClick: () => {
      console.log('Clicked')
    }
  }
})
```

### 3. 路径错误

```typescript
// ❌ 错误：路径格式不正确
const schema = {
  type: 'input',
  model: 'user..name'  // 双点
}

// ✅ 正确：使用正确的路径
const schema = {
  type: 'input',
  model: 'user.name'
}
```

### 4. 异步错误

```typescript
// ❌ 错误：未处理 Promise 错误
methods: {
  fetchData: async ({ state }) => {
    const data = await api.fetch()  // 可能失败
    state.data = data
  }
}

// ✅ 正确：使用 try-catch
methods: {
  fetchData: async ({ state }) => {
    try {
      state.loading = true
      const data = await api.fetch()
      state.data = data
    } catch (error) {
      state.error = error.message
    } finally {
      state.loading = false
    }
  }
}
```

## 相关链接

- [API 文档 - useVario](/packages/vue/api)
- [Core 错误处理](/packages/core/security-performance#错误处理)
- [表达式系统](/packages/core/expression)
- [最佳实践](/packages/vue/best-practices)
