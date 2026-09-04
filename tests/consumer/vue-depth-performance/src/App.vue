<template>
  <component :is="vnode" />
</template>

<script setup>
import { useVario } from '../../../../packages/vario-vue/src/index.js'

const n = 200
const schema = {
  type: 'div',
  children: Array.from({ length: n }, (_, i) => ({ type: 'span', children: `n-${i}` }))
}
const { vnode } = useVario(schema, { state: {} })
</script>
