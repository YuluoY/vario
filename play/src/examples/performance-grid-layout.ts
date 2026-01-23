import type { Schema } from '@vario/schema'

/**
 * 网格布局场景
 * ElRow + ElCol + ElCard + ElTag + ElButton 组合
 */
export const createGridLayoutSchema = (componentCount: number): Schema => {
  const colsPerRow = 4
  const rows = Math.ceil(componentCount / colsPerRow)
  
  return {
    type: 'div',
    props: { style: 'padding: 16px;' },
    children: Array.from({ length: rows }, (_, row) => ({
      type: 'ElRow',
      props: { gutter: 16, style: 'margin-bottom: 16px;' },
      children: Array.from({ length: colsPerRow }, (_, col) => {
        const idx = row * colsPerRow + col
        if (idx >= componentCount) return null
        return {
          type: 'ElCol',
          props: { span: 24 / colsPerRow },
          children: [
            {
              type: 'ElCard',
              props: { shadow: 'hover', header: `Card ${idx}` },
              children: [
                {
                  type: 'ElTag',
                  props: { type: idx % 4 === 0 ? 'success' : idx % 4 === 1 ? 'warning' : idx % 4 === 2 ? 'danger' : 'info' },
                  children: `Tag ${idx}`
                },
                {
                  type: 'ElButton',
                  props: { type: 'primary', size: 'small', style: 'margin-left: 8px;' },
                  children: `Action ${idx}`
                }
              ]
            }
          ]
        }
      }).filter(Boolean) as Schema[]
    })) as Schema[]
  }
}
