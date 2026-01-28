# defineSchema

**defineSchema** 把“状态 + 服务 + schema 函数”打包成一个 **VarioView**：在调用时执行 schema 函数得到纯 Schema，并做校验与规范化，同时提供类型推导（InferStateType、InferServicesFromConfig 等）。

## 基本用法

```typescript
import { defineSchema } from '@variojs/schema'
import type { RuntimeContext } from '@variojs/core'

const view = defineSchema({
  state: {
    name: '',
    count: 0
  },
  services: {
    increment: (ctx) => {
      ctx._set('count', ctx._get('count') + 1)
    }
  },
  schema: (ctx) => ({
    type: 'div',
    children: [
      { type: 'input', model: 'name', props: { placeholder: '姓名' } },
      {
        type: 'button',
        events: { click: [{ type: 'call', method: 'increment' }] },
        children: 'count: {{ count }}'
      }
    ]
  })
})

// view.schema 为规范化后的 Schema（纯 JSON 形态）
// view.stateType / view.servicesType 可用于类型推导
```

**DefineSchemaConfig** 包含：

- **state**：初始状态，用于类型推导和传给 schema 的 ctx。
- **services**（可选）：业务方法，会注册到上下文中，供 schema 里 `call` 等方法调用。
- **schema**：`(ctx: RuntimeContext<TState>) => Schema<TState>`，在 define 时被调用一次，得到一棵静态 Schema 树。

注意：当前实现里，defineSchema 内部会创建**临时** RuntimeContext 仅用于执行 schema 函数并得到树，真正渲染时仍由 **@vario/vue** 的 useVario 再建自己的 Context。因此“服务”如何挂到 useVario 的 methods，要看 Vue 集成是否从 view 上读取并注入；类型上可先用 InferStateType / InferServicesFromConfig 保证状态和方法签名一致。

## 类型推导

```typescript
import type { InferStateType, InferServicesFromConfig } from '@variojs/schema'

type State = InferStateType<typeof view>
type Services = InferServicesFromConfig<typeof view>
```

便于在 useVario、API 或测试里复用同一份状态/服务类型。

## 错误

- **DefineSchemaConfigError**：配置不合法或 schema 函数执行失败、或 **validateSchema** 未通过时抛出，通常带 **field** 指向 state / services / schema。
- 校验错误会包在 DefineSchemaConfigError 的 message 里，并保留 path 等信息。

## 与 useVario 的配合

若把 **view.schema** 交给 useVario，并保证 **state**、**methods** 与 view 的 state/services 一致，即可在 Vue 里渲染该视图。推荐用 InferStateType\<typeof view\> 作为 useVario 的泛型，减少重复定义。详见 [@vario/vue 最佳实践](/packages/vue/best-practices)。
