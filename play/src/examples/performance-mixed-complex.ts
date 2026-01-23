import type { Schema } from '@vario/schema'

/**
 * 混合复杂组件场景
 * ElCard + ElTag + ElInput + ElButton 组合，包含具名插槽
 */
export const createMixedComplexSchema = (componentCount: number): Schema => {
  return {
    type: 'div',
    props: { style: 'padding: 16px;' },
    children: Array.from({ length: componentCount }, (_, j) => ({
      type: 'ElCard',
      props: { shadow: 'hover', style: 'margin-bottom: 16px;' },
      children: [
        {
          type: 'template',
          slot: 'header',
          children: [
            {
              type: 'span',
              children: `Card ${j}`
            },
            {
              type: 'ElTag',
              props: { type: j % 4 === 0 ? 'success' : j % 4 === 1 ? 'warning' : j % 4 === 2 ? 'danger' : 'info', style: 'margin-left: 8px;' },
              children: `Tag ${j}`
            }
          ]
        },
        {
          type: 'div',
          props: { style: 'padding: 8px;' },
          children: [
            {
              type: 'ElInput',
              props: { placeholder: `Input ${j}`, style: 'margin-bottom: 8px;' },
              model: `input${j}`
            },
            {
              type: 'ElButton',
              props: { type: 'primary', size: 'small' },
              children: `Button ${j}`
            }
          ]
        }
      ]
    })) as Schema[]
  }
}
