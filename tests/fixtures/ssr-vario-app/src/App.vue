<template>
  <component :is="vnode" />
</template>

<script setup>
import { useVario } from '../../../../packages/vario-vue/src/index.js'

const schema = {
  type: 'div',
  children: [
    { type: 'span', children: '{{ label }}' },
    { type: 'div', cond: '{{ show }}', children: 'shown' }
  ]
}
const { vnode } = useVario(schema, { state: { label: 'Ada', show: true } })
</script>
