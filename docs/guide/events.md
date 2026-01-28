# 事件处理

```typescript
const schema: VueSchemaNode = {
  type: 'ElButton',
  events: {
    click: {
      type: 'call',
      method: 'handleClick'
    }
  },
  children: '点击'
}

const { methods } = useVario(schema, {
  state: {},
  methods: {
    handleClick: ({ state, ctx, event }) => {
      console.log('Button clicked', event)
    }
  }
})
```

事件通过 `events` 声明，`type: 'call'` 时调用 `methods` 中对应方法，参数为 `MethodContext`（含 `state`、`ctx`、`event` 等）。
