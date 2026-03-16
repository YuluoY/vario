# 插件系统

Vario Vue 渲染器采用插件架构，将 Vue 特有特性（生命周期、Transition、KeepAlive、Teleport）从核心渲染管线中解耦。你可以按需加载内置插件，也可以编写自定义插件扩展渲染行为。

## 概述

### 设计目标

- **按需加载**：未使用的 Vue 特性不参与渲染管线
- **可 tree-shake**：打包时自动剔除未引用的插件代码
- **清晰边界**：Schema 核心管线 (`cond/show/loop/model/events`) 与 Vue 特性解耦
- **可扩展**：通过 `VNodePlugin` 接口自定义渲染行为

### 架构位置

插件系统工作在 `createVNode` 管线的两个阶段：

```
步骤 12: wrapComponent 插件
  ↓ 拦截 h(component, attrs, children) 调用
  ↓ 如：lifecycle/provide-inject 需要 defineComponent 包装

步骤 13: decorateVNode 插件
  ↓ 在 VNode 创建后依次包裹
  ↓ 如：KeepAlive → Transition → Teleport（内层到外层）
```

## VNodePlugin 接口

```typescript
interface VNodePlugin {
  /** 插件名称（调试用） */
  name: string

  /**
   * 组件包装阶段：拦截 h(component, attrs, children) 调用
   * @returns VNode — 使用插件生成的 VNode
   * @returns null  — 该插件不处理，继续尝试下一个插件
   */
  wrapComponent?: (
    component: any,
    attrs: Record<string, any>,
    children: any,
    schema: VueSchemaNode,
    ctx: RuntimeContext
  ) => VNode | null

  /**
   * VNode 装饰阶段：在 VNode 创建后依次包装
   * 多个 decorate 插件按注册顺序依次执行。
   * @returns 装饰后的 VNode（返回原 vnode 表示不处理）
   */
  decorateVNode?: (
    vnode: VNode,
    schema: VueSchemaNode,
    ctx: RuntimeContext
  ) => VNode
}
```

### 两个 Hook 的区别

| | `wrapComponent` | `decorateVNode` |
|---|---|---|
| 执行时机 | 替代 `h()` 调用 | `h()` 之后 |
| 返回语义 | `null` = 不处理，交给下一个插件 | 必须返回 VNode |
| 典型场景 | 需要改变组件创建方式（如 defineComponent 包装） | 外层包裹（Transition、KeepAlive、Teleport） |
| 短路行为 | 第一个返回非 null 的插件"赢" | 所有插件链式执行 |

## 内置插件

Vario 提供 4 个内置插件：

| 插件 | Hook | Schema 字段 | 说明 |
|---|---|---|---|
| `lifecyclePlugin` | `wrapComponent` | `onMounted`, `onUnmounted`, `provide`, `inject` 等 | 生命周期钩子 + 依赖注入 |
| `keepAlivePlugin` | `decorateVNode` | `keepAlive` | 缓存组件实例 |
| `transitionPlugin` | `decorateVNode` | `transition` | 过渡动画 |
| `teleportPlugin` | `decorateVNode` | `teleport` | DOM 传送 |

### defaultPlugins

未指定 `plugins` 选项时，渲染器自动使用 `defaultPlugins`（包含全部 4 个内置插件）：

```typescript
import { defaultPlugins } from '@variojs/vue'

// 等同于：
const defaultPlugins = [
  lifecyclePlugin,   // wrapComponent
  keepAlivePlugin,   // decorateVNode
  transitionPlugin,  // decorateVNode
  teleportPlugin,    // decorateVNode
]
```

**顺序约定**：`wrapComponent` 插件在前，`decorateVNode` 插件按语义顺序排列（内层 → 外层）。

## 配置插件

### 使用全部内置插件（默认）

```typescript
const { render } = useVario(schema, {
  components: { ElButton, ElInput },
  state: { count: 0 }
  // 未传 plugins，自动使用 defaultPlugins
})
```

### 按需加载

如果你的 Schema 不使用 Transition 和 KeepAlive，可以只加载需要的插件：

```typescript
import { lifecyclePlugin, teleportPlugin } from '@variojs/vue'

const { render } = useVario(schema, {
  plugins: [lifecyclePlugin, teleportPlugin],
  components: { ElButton, ElInput },
  state: { count: 0 }
})
```

这样 `keepAlivePlugin` 和 `transitionPlugin` 的代码会被 tree-shake 掉。

### 禁用所有插件

```typescript
const { render } = useVario(schema, {
  plugins: [],
  components: { ElButton },
  state: { count: 0 }
})
```

## 编写自定义插件

### 示例 1：日志插件（decorateVNode）

记录每个 VNode 的创建：

```typescript
import type { VNodePlugin } from '@variojs/vue'

const logPlugin: VNodePlugin = {
  name: 'log',
  decorateVNode(vnode, schema, ctx) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[vario] render: ${schema.type}`)
    }
    return vnode  // 不修改，原样返回
  }
}
```

### 示例 2：权限插件（decorateVNode）

根据用户角色控制节点可见性：

```typescript
import { h, Comment, type VNode } from 'vue'
import type { VNodePlugin, VueSchemaNode, RuntimeContext } from '@variojs/vue'

const authPlugin: VNodePlugin = {
  name: 'auth',
  decorateVNode(vnode: VNode, schema: VueSchemaNode, ctx: RuntimeContext): VNode {
    const requiredRole = (schema.props as any)?.['data-require-role']
    if (!requiredRole) return vnode

    const userRole = ctx._get?.('userRole')
    if (userRole === requiredRole) return vnode

    // 无权限则渲染为注释节点
    return h(Comment, `auth: requires ${requiredRole}`)
  }
}
```

### 示例 3：错误边界包装插件（wrapComponent）

为特定组件添加错误边界：

```typescript
import { defineComponent, h, onErrorCaptured, ref, type VNode } from 'vue'
import type { VNodePlugin } from '@variojs/vue'

const errorBoundaryPlugin: VNodePlugin = {
  name: 'error-boundary',
  wrapComponent(component, attrs, children, schema, ctx): VNode | null {
    if (!schema.props?.['data-error-boundary']) return null

    const Wrapper = defineComponent({
      setup(_, { slots }) {
        const hasError = ref(false)
        onErrorCaptured(() => {
          hasError.value = true
          return false
        })
        return () => hasError.value
          ? h('div', { class: 'error-fallback' }, '组件加载失败')
          : h(component, attrs, slots)
      }
    })
    return h(Wrapper, null, () => children)
  }
}
```

### 组合使用

将自定义插件与内置插件组合：

```typescript
import { defaultPlugins } from '@variojs/vue'

const { render } = useVario(schema, {
  plugins: [...defaultPlugins, logPlugin, authPlugin],
  components: { ElButton },
  state: { userRole: 'admin' }
})
```

## 插件执行顺序

插件按数组顺序执行：

- **`wrapComponent`**：从前往后查找，**第一个返回非 `null` 的插件胜出**，后续不再执行
- **`decorateVNode`**：所有插件依次执行，每个插件接收上一个插件的输出

```
defaultPlugins 执行流程：
  wrapComponent: lifecyclePlugin（有生命周期时接管，否则 null → 回退到默认 h()）
  decorateVNode: keepAlivePlugin → transitionPlugin → teleportPlugin
```

如果你需要覆盖内置行为，将自定义插件放在内置插件**之前**：

```typescript
const { render } = useVario(schema, {
  plugins: [myLifecyclePlugin, ...defaultPlugins],
  // myLifecyclePlugin.wrapComponent 会先执行，
  // 如果它返回非 null，内置 lifecyclePlugin 不再执行
})
```

## 最佳实践

1. **插件应保持纯粹**：每个插件只关注一个 Schema 字段，检测到不相关的 schema 时立即返回（`null` 或原 `vnode`）
2. **命名清晰**：`name` 用于调试输出，取有意义的名字
3. **按需加载**：生产环境中只加载实际使用的插件，减小打包体积
4. **注意顺序**：`decorateVNode` 的包裹顺序影响 DOM 结构（内层先注册、外层后注册）
5. **避免副作用**：插件不应修改 `schema` 或 `ctx`，只应基于它们生成/修饰 VNode
