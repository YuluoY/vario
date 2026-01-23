import type { Schema } from '@vario/schema'

/**
 * 深层嵌套场景
 * 创建 componentCount 个深度为 10 层的嵌套链
 * 线性增长，避免指数级内存消耗
 */
export const createDeepNestingSchema = (componentCount: number): Schema => {
  const nestingDepth = 10
  
  const createDeepChain = (index: number): Schema => {
    let chain: Schema = {
      type: 'ElButton',
      props: { type: 'primary', size: 'small' },
      children: `Button ${index}`
    }
    for (let level = nestingDepth - 1; level >= 0; level--) {
      chain = {
        type: 'ElCard',
        props: { shadow: 'hover', header: `Chain ${index} - Level ${level}`, style: 'margin: 4px; padding: 4px;' },
        children: [chain]
      }
    }
    return chain
  }
  
  return {
    type: 'div',
    props: { style: 'padding: 16px; display: flex; flex-wrap: wrap; gap: 8px;' },
    children: Array.from({ length: componentCount }, (_, i) => createDeepChain(i))
  }
}
