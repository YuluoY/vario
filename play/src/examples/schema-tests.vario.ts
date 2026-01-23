/**
 * Schema Tests 示例
 * 用于 SchemaTests.vue 组件的示例 schemas
 */

import type { Schema } from '@vario/schema'

export const schemaExamples: Record<string, Schema> = {
  button: {
    type: 'ElButton',
    props: {
      type: 'primary',
      size: 'large'
    },
    children: 'Primary Button'
  },
  input: {
    type: 'ElInput',
    props: {
      placeholder: 'Enter text...',
      model: 'inputValue'
    },
    model: 'inputValue'
  },
  list: {
    type: 'div',
    props: { style: 'display: flex; flex-wrap: wrap; gap: 10px; padding: 20px;' },
    children: [
      {
        type: 'h4',
        props: { style: 'width: 100%; margin-bottom: 10px;' },
        children: 'Items List:'
      },
      {
        type: 'ElTag',
        loop: {
          items: '{{ items }}',
          itemKey: 'item'
        },
        props: { 
          type: 'primary',
          style: 'margin-right: 8px; margin-bottom: 8px;'
        },
        children: '{{ $index + 1 }}. {{ $record }}'
      }
    ]
  }
}
