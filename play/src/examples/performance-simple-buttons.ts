import type { Schema } from '@variojs/schema'

/**
 * 简单按钮场景
 * 创建平铺的按钮列表
 */
export const createSimpleButtonsSchema = (componentCount: number): Schema => {
  return {
    type: 'div',
    props: { style: 'padding: 16px; display: flex; flex-wrap: wrap; gap: 8px;' },
    children: Array.from({ length: componentCount }, (_, j) => ({
      type: 'ElButton',
      props: { 
        type: j % 3 === 0 ? 'primary' : j % 3 === 1 ? 'success' : 'info',
        size: 'small'
      },
      children: `Button ${j}`
    })) as Schema[]
  }
}
