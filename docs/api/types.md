# 类型支持

```typescript
import type { VueSchemaNode } from '@variojs/vue'

// VueSchemaNode 在 SchemaNode 基础上增加 Vue 特有属性
const schema: VueSchemaNode = {
  type: 'div',
  ref: 'container',
  onMounted: 'init',
  model: 'form',
  show: 'visible',
  loop: { items: '{{ list }}', itemKey: 'item' },
  events: { click: { type: 'call', method: 'handleClick' } },
  provide: {},
  inject: [],
  teleport: 'body',
  transition: 'fade',
  keepAlive: true,
  // ... 其他 SchemaNode 与 Vue 扩展属性
}
```

从 `@variojs/vue` 导出或再导出的类型包括：`VueSchemaNode`、`UseVarioOptions`、`UseVarioResult`、`VueRendererOptions` 等，可直接用于 TypeScript 与 IDE 推断。
