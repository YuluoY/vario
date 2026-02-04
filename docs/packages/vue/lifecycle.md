# Vue 生命周期集成

Vario 完整支持 Vue 3 的组件生命周期钩子，允许在 Schema 中声明生命周期方法，实现初始化、清理、更新等逻辑。

## 概述

通过在 `VueSchemaNode` 中声明生命周期钩子属性，Vario 会在相应的生命周期阶段调用对应的 methods：

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  onMounted: 'init',      // 挂载后调用
  onUnmounted: 'cleanup', // 卸载前调用
  children: '...'
}

const { vnode } = useVario(schema, {
  methods: {
    init: ({ state, ctx }) => {
      console.log('组件已挂载')
      // 初始化逻辑
    },
    cleanup: ({ state, ctx }) => {
      console.log('组件即将卸载')
      // 清理逻辑
    }
  }
})
```

## 支持的生命周期钩子

Vario 支持以下 Vue 3 生命周期钩子：

| 钩子属性 | Vue API | 调用时机 | 常见用途 |
|---------|---------|---------|---------|
| `onBeforeMount` | `onBeforeMount()` | 挂载之前 | 准备工作、预加载 |
| `onMounted` | `onMounted()` | 挂载完成后 | **初始化、数据加载、DOM 操作** |
| `onBeforeUpdate` | `onBeforeUpdate()` | 更新之前 | 记录更新前状态 |
| `onUpdated` | `onUpdated()` | 更新完成后 | DOM 更新后的处理 |
| `onBeforeUnmount` | `onBeforeUnmount()` | 卸载之前 | 清理前的保存操作 |
| `onUnmounted` | `onUnmounted()` | 卸载完成后 | **清理资源、取消订阅** |
| `onActivated` | `onActivated()` | keep-alive 激活 | 恢复状态 |
| `onDeactivated` | `onDeactivated()` | keep-alive 停用 | 暂停状态 |

> **最常用**：`onMounted`（初始化）和 `onUnmounted`（清理）

## 基础用法

### onMounted - 初始化

最常用的生命周期钩子，用于组件挂载后的初始化：

```typescript
const schema = {
  type: 'div',
  onMounted: 'loadData',
  children: [
    {
      type: 'ElTable',
      props: {
        data: '{{ tableData }}'
      }
    }
  ]
}

const { vnode } = useVario(schema, {
  state: {
    tableData: []
  },
  methods: {
    async loadData({ state, ctx }) {
      // 加载数据
      const response = await fetch('/api/data')
      state.tableData = await response.json()
      
      console.log('数据加载完成:', state.tableData)
    }
  }
})
```

### onUnmounted - 清理资源

用于清理定时器、取消订阅、释放资源：

```typescript
const schema = {
  type: 'div',
  onMounted: 'startPolling',
  onUnmounted: 'stopPolling',
  children: '{{ message }}'
}

let intervalId: number | null = null

const { vnode } = useVario(schema, {
  state: {
    message: '等待数据...'
  },
  methods: {
    startPolling({ state }) {
      // 启动定时轮询
      intervalId = window.setInterval(async () => {
        const data = await fetch('/api/status').then(r => r.json())
        state.message = data.message
      }, 5000)
      
      console.log('轮询已启动')
    },
    
    stopPolling() {
      // 清理定时器
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
      console.log('轮询已停止')
    }
  }
})
```

### onUpdated - DOM 更新后处理

```typescript
const schema = {
  type: 'div',
  ref: 'container',
  onUpdated: 'handleUpdate',
  children: '{{ content }}'
}

const { vnode, refs } = useVario(schema, {
  state: {
    content: 'Initial'
  },
  methods: {
    handleUpdate({ ctx }) {
      // 更新后处理 DOM
      const container = refs.container.value
      if (container) {
        console.log('DOM 已更新，高度:', container.offsetHeight)
        // 可以执行滚动、动画等操作
      }
    }
  }
})
```

### onActivated / onDeactivated - KeepAlive 支持

配合 `keep-alive` 使用：

```typescript
const schema = {
  type: 'div',
  keepAlive: true,
  onActivated: 'resumeState',
  onDeactivated: 'pauseState',
  children: '...'
}

const { vnode } = useVario(schema, {
  methods: {
    resumeState({ state }) {
      console.log('组件激活，恢复状态')
      // 重新订阅、刷新数据等
    },
    
    pauseState({ state }) {
      console.log('组件停用，暂停状态')
      // 取消订阅、保存状态等
    }
  }
})
```

## 实战示例

### 示例 1：表单初始化与验证

```typescript
const schema = {
  type: 'ElForm',
  ref: 'formRef',
  props: {
    model: '{{ $self }}',
    rules: '{{ formRules }}'
  },
  onMounted: 'initForm',
  onBeforeUnmount: 'saveFormDraft',
  children: [
    {
      type: 'ElFormItem',
      props: { label: '用户名', prop: 'username' },
      children: {
        type: 'ElInput',
        model: 'username'
      }
    },
    {
      type: 'ElFormItem',
      props: { label: '邮箱', prop: 'email' },
      children: {
        type: 'ElInput',
        model: 'email'
      }
    },
    {
      type: 'ElButton',
      props: { type: 'primary' },
      events: {
        click: 'submitForm'
      },
      children: '提交'
    }
  ]
}

const { vnode, refs } = useVario(schema, {
  state: {
    username: '',
    email: '',
    formRules: {
      username: [{ required: true, message: '请输入用户名' }],
      email: [{ required: true, type: 'email', message: '请输入有效邮箱' }]
    }
  },
  methods: {
    async initForm({ state, ctx }) {
      // 从草稿恢复
      const draft = localStorage.getItem('form-draft')
      if (draft) {
        const data = JSON.parse(draft)
        Object.assign(state, data)
        console.log('表单草稿已恢复')
      }
      
      // 或从服务器加载
      try {
        const userData = await fetch('/api/user/profile').then(r => r.json())
        state.username = userData.username
        state.email = userData.email
      } catch (error) {
        console.error('加载用户数据失败:', error)
      }
    },
    
    saveFormDraft({ state }) {
      // 保存草稿到 localStorage
      const draft = {
        username: state.username,
        email: state.email
      }
      localStorage.setItem('form-draft', JSON.stringify(draft))
      console.log('表单草稿已保存')
    },
    
    async submitForm({ state, ctx }) {
      const formRef = refs.formRef.value
      if (!formRef) return
      
      // 验证表单
      const valid = await formRef.validate().catch(() => false)
      if (!valid) return
      
      // 提交数据
      await fetch('/api/user/update', {
        method: 'POST',
        body: JSON.stringify({ username: state.username, email: state.email })
      })
      
      // 清除草稿
      localStorage.removeItem('form-draft')
      console.log('提交成功')
    }
  }
})
```

### 示例 2：实时数据监听与 WebSocket

```typescript
const schema = {
  type: 'div',
  onMounted: 'connectWebSocket',
  onUnmounted: 'disconnectWebSocket',
  children: [
    {
      type: 'div',
      children: '在线用户: {{ onlineCount }}'
    },
    {
      type: 'ul',
      children: {
        type: 'li',
        loop: {
          items: '{{ messages }}',
          itemKey: 'message'
        },
        children: '{{ message.text }}'
      }
    }
  ]
}

let ws: WebSocket | null = null

const { vnode } = useVario(schema, {
  state: {
    onlineCount: 0,
    messages: [] as Array<{ id: string; text: string }>
  },
  methods: {
    connectWebSocket({ state }) {
      ws = new WebSocket('wss://example.com/chat')
      
      ws.onopen = () => {
        console.log('WebSocket 已连接')
      }
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'online-count') {
          state.onlineCount = data.count
        } else if (data.type === 'message') {
          state.messages.push({
            id: data.id,
            text: data.text
          })
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket 错误:', error)
      }
      
      ws.onclose = () => {
        console.log('WebSocket 已关闭')
      }
    },
    
    disconnectWebSocket() {
      if (ws) {
        ws.close()
        ws = null
        console.log('WebSocket 连接已断开')
      }
    }
  }
})
```

### 示例 3：图表初始化与更新

```typescript
import * as echarts from 'echarts'

const schema = {
  type: 'div',
  ref: 'chartContainer',
  props: {
    style: { width: '600px', height: '400px' }
  },
  onMounted: 'initChart',
  onUpdated: 'updateChart',
  onBeforeUnmount: 'disposeChart'
}

let chartInstance: echarts.ECharts | null = null

const { vnode, refs } = useVario(schema, {
  state: {
    chartData: [120, 200, 150, 80, 70, 110, 130]
  },
  methods: {
    initChart({ state }) {
      const container = refs.chartContainer.value
      if (!container) return
      
      // 初始化图表
      chartInstance = echarts.init(container)
      
      const option = {
        xAxis: {
          type: 'category',
          data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          data: state.chartData,
          type: 'line'
        }]
      }
      
      chartInstance.setOption(option)
      console.log('图表已初始化')
      
      // 监听窗口大小变化
      window.addEventListener('resize', () => {
        chartInstance?.resize()
      })
    },
    
    updateChart({ state }) {
      if (!chartInstance) return
      
      // 更新图表数据
      chartInstance.setOption({
        series: [{
          data: state.chartData
        }]
      })
      console.log('图表已更新')
    },
    
    disposeChart() {
      if (chartInstance) {
        chartInstance.dispose()
        chartInstance = null
        console.log('图表已销毁')
      }
      
      // 移除事件监听
      window.removeEventListener('resize', () => {})
    }
  }
})
```

### 示例 4：多节点生命周期

不同节点可以有自己的生命周期钩子：

```typescript
const schema = {
  type: 'div',
  onMounted: 'initContainer',
  children: [
    {
      type: 'div',
      onMounted: 'loadHeader',
      children: 'Header'
    },
    {
      type: 'div',
      onMounted: 'loadContent',
      onUpdated: 'scrollToBottom',
      children: [
        {
          type: 'ul',
          loop: {
            items: '{{ messages }}',
            itemKey: 'msg'
          },
          children: {
            type: 'li',
            children: '{{ msg }}'
          }
        }
      ]
    },
    {
      type: 'div',
      onMounted: 'loadFooter',
      children: 'Footer'
    }
  ]
}

const { vnode } = useVario(schema, {
  state: {
    messages: []
  },
  methods: {
    initContainer() {
      console.log('容器已挂载')
    },
    loadHeader() {
      console.log('Header 已挂载')
    },
    loadContent() {
      console.log('Content 已挂载')
    },
    scrollToBottom({ ctx }) {
      // 内容更新后滚动到底部
      const container = ctx.$self?.ref
      if (container) {
        // 滚动逻辑
      }
    },
    loadFooter() {
      console.log('Footer 已挂载')
    }
  }
})
```

## 执行顺序

生命周期钩子的执行顺序遵循 Vue 的规则：

### 挂载阶段

```
父 onBeforeMount
  → 子 onBeforeMount
  → 子 onMounted
  → 父 onMounted
```

### 更新阶段

```
父 onBeforeUpdate
  → 子 onBeforeUpdate
  → 子 onUpdated
  → 父 onUpdated
```

### 卸载阶段

```
父 onBeforeUnmount
  → 子 onBeforeUnmount
  → 子 onUnmounted
  → 父 onUnmounted
```

**示例验证：**

```typescript
const schema = {
  type: 'div',
  onBeforeMount: 'parentBeforeMount',
  onMounted: 'parentMounted',
  children: [
    {
      type: 'div',
      onBeforeMount: 'childBeforeMount',
      onMounted: 'childMounted',
      children: 'Child'
    }
  ]
}

const { vnode } = useVario(schema, {
  methods: {
    parentBeforeMount() {
      console.log('1. 父节点 beforeMount')
    },
    childBeforeMount() {
      console.log('2. 子节点 beforeMount')
    },
    childMounted() {
      console.log('3. 子节点 mounted')
    },
    parentMounted() {
      console.log('4. 父节点 mounted')
    }
  }
})

// 输出：
// 1. 父节点 beforeMount
// 2. 子节点 beforeMount
// 3. 子节点 mounted
// 4. 父节点 mounted
```

## 与 Composition API 的对比

Vario 的生命周期钩子与 Vue Composition API 的对应关系：

| Vario Schema | Composition API |
|-------------|-----------------|
| `onBeforeMount: 'method'` | `onBeforeMount(() => { ... })` |
| `onMounted: 'method'` | `onMounted(() => { ... })` |
| `onBeforeUpdate: 'method'` | `onBeforeUpdate(() => { ... })` |
| `onUpdated: 'method'` | `onUpdated(() => { ... })` |
| `onBeforeUnmount: 'method'` | `onBeforeUnmount(() => { ... })` |
| `onUnmounted: 'method'` | `onUnmounted(() => { ... })` |
| `onActivated: 'method'` | `onActivated(() => { ... })` |
| `onDeactivated: 'method'` | `onDeactivated(() => { ... })` |

**区别：**
- Vario：声明式，在 Schema 中配置方法名
- Composition API：命令式，直接编写回调函数

## TypeScript 类型

```typescript
import type { VueSchemaNode, MethodContext } from '@variojs/vue'

interface MyState {
  count: number
  data: string[]
}

const schema: VueSchemaNode<MyState> = {
  type: 'div',
  onMounted: 'init',  // ✅ 类型安全的方法名
  onUnmounted: 'cleanup'
}

const methods = {
  init: ({ state, ctx }: MethodContext<MyState>) => {
    state.count = 0  // ✅ 完整的类型提示
  },
  cleanup: ({ state, ctx }: MethodContext<MyState>) => {
    // 清理逻辑
  }
}
```

## 注意事项

1. **方法必须在 methods 中定义**：Schema 中的生命周期钩子只是方法名字符串，实际逻辑在 `useVario` 的 `methods` 选项中定义

2. **异步支持**：生命周期方法支持 async/await：
   ```typescript
   methods: {
     async init({ state }) {
       const data = await fetch('/api/data')
       state.data = await data.json()
     }
   }
   ```

3. **多次调用**：同一个方法可以被多个节点的生命周期钩子引用

4. **访问 DOM**：在 `onMounted` 及之后才能访问 DOM 元素（通过 `ref`）

5. **清理资源**：务必在 `onUnmounted` 中清理定时器、订阅、监听器等，防止内存泄漏

6. **KeepAlive 特殊性**：使用 `keepAlive: true` 时，`onActivated` 和 `onDeactivated` 会在组件激活/停用时触发，而 `onMounted`/`onUnmounted` 只在首次挂载/最终卸载时触发

## 最佳实践

### ✅ 推荐

```typescript
// 1. onMounted 中加载数据
onMounted: 'loadData'

// 2. onUnmounted 中清理资源
onUnmounted: 'cleanup'

// 3. 使用 async/await 处理异步逻辑
methods: {
  async loadData({ state }) {
    state.data = await fetchData()
  }
}

// 4. 多个节点共享同一个方法
const schema = {
  children: [
    { type: 'div', onMounted: 'log' },
    { type: 'span', onMounted: 'log' }
  ]
}
```

### ❌ 避免

```typescript
// 1. 不要在 onBeforeMount 中访问 DOM
onBeforeMount: 'accessDOM'  // ❌ DOM 还未创建

// 2. 不要忘记清理资源
onMounted: 'startTimer'  // ❌ 没有 onUnmounted 清理

// 3. 不要在生命周期中执行耗时同步操作
methods: {
  init() {
    for (let i = 0; i < 1000000; i++) { /* 阻塞 */ }  // ❌
  }
}

// 4. 不要直接操作外部变量（应该使用 state）
let externalVar = 0
methods: {
  init() {
    externalVar++  // ❌ 不响应式
  }
}
```

## 相关文档

- [useVario API](/api/use-vario) - useVario 完整 API 参考
- [Vue 特性](/guide/vue-features) - Vue 集成功能概览
- [useVario API](/api/use-vario) - 方法定义与使用
- [Refs](/packages/vue/refs) - 获取组件实例引用
- [错误处理](/packages/vue/error-handling) - 错误边界与异常处理
