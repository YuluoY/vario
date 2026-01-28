# 控制流

## 条件渲染

```typescript
{
  type: 'div',
  cond: 'isVisible',   // 条件渲染（v-if）
  // 或
  show: 'isVisible',   // 条件显示（v-show）
  children: 'Content'
}
```

## 循环渲染

```typescript
const schema: VueSchemaNode = {
  type: 'div',
  loop: {
    items: '{{ userList }}',
    itemKey: 'item',
    indexKey: 'index'  // 可选
  },
  children: [
    {
      type: 'div',
      children: '{{ index + 1 }}. {{ item.name }}'
    }
  ]
}
```
