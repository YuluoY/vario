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
    indexKey: 'index',  // 可选
    key: 'uid',         // 可选：稳定 item key（v0.4+）
    virtual: true       // 可选：宿主虚拟化（v0.4+）
  },
  children: [
    {
      type: 'div',
      children: '{{ index + 1 }}. {{ item.name }}'
    }
  ]
}
```

### LoopConfig 完整字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `items` | ✅ | 数据源路径表达式，求值结果须为数组 |
| `itemKey` | ✅ | 循环变量名，循环体内通过它访问当前项 |
| `indexKey` | | 索引变量名。缺省时 legacy 管线不暴露索引；prepared 管线默认 `'index'` 并始终暴露 |
| `key` | | 稳定 item key 表达式，见下文 |
| `virtual` | | 是否对该 loop 使用宿主虚拟化，见下文 |

### key 稳定 item key

`key` 指向 item 上的一个属性（如 `'uid'` 会读取 `item.uid`），渲染器用它生成循环项的 diff key，取值顺序为：

1. `key` 指定的属性值（为 `null`/对象时抛 `LOOP_INVALID_KEY`）
2. 缺省回退 `item.id`（非 null 时）
3. 再回退 `` `${itemKey}:${index}` ``（如 `item:3`）

若解析出的 key 在列表内重复，会抛 `LOOP_DUPLICATE_KEY` 并发出 `loop-duplicate-key` 诊断。

```typescript
loop: {
  items: '{{ orders }}',
  itemKey: 'order',
  key: 'orderNo'   // 用业务单号做 key，列表重排/插入时能复用已有项
}
```

适合列表会**重排、插入、删除**的场景——按 index 回退的 key 在这些操作下会导致整表重渲染。注意 `key` 是 prepared 渲染管线（`runtimeMode: 'shadow' | 'prepared'`）中的能力，legacy 管线下循环 key 仍走 `props.key` 表达式的方式（见[性能指南](/guide/performance#循环-key-优化)）。

### virtual 宿主虚拟化

`virtual` 控制该循环是否走宿主虚拟化渲染，需配合 `useVario` 的 `virtualAdapter` 选项：

```typescript
import { createReferenceVirtualAdapter } from '@variojs/vue'

const { vnode } = useVario(schema, {
  virtualAdapter: createReferenceVirtualAdapter({ viewport: 200, overscan: 4 })
})
```

- `virtual: true`（或缺省）：若提供了 `virtualAdapter`，只渲染可视范围内的循环项
- `virtual: false`：强制全量展开，但仍受 `runtimeBudget` 预算约束（超出抛 `LOOP_BUDGET_EXCEEDED`）

列表项数超过预算阈值（默认 `maxLoopItemsPerRegion = 1000`）时会发出 `LOOP_LARGE_LIST` 诊断（不截断，全量渲染），此时建议接入虚拟化适配器。详见[性能指南](/guide/performance#长列表虚拟化)。
