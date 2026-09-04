export const isolationFixtures = Array.from({ length: 50 }, (_, i) => ({
  n: i,
  label: `req-${i}`,
  schema: { type: 'span', children: '{{ n }}' }
}))

export const hydrateFixtures = [
  { schema: { type: 'div', cond: '{{ show }}', children: 'shown' }, state: { show: true } },
  { schema: { type: 'div', show: '{{ visible }}', children: 'v' }, state: { visible: true } },
  {
    schema: {
      type: 'ul',
      loop: { items: 'items', itemKey: 'item', indexKey: 'index' },
      children: [{ type: 'li', children: '{{ item }}' }]
    },
    state: { items: ['a', 'b'] }
  },
  { schema: { type: 'span', children: '{{ label }}' }, state: { label: 'Ada' } }
]
