import type { Schema } from '@vario/schema'

/**
 * 嵌套卡片场景
 * 每个卡片包含 5 层嵌套，总共创建 componentCount 个这样的卡片组
 * 线性增长，避免指数级内存消耗
 */
export const createNestedCardsSchema = (componentCount: number): Schema => {
  const createNestedCard = (index: number): Schema => {
    let innerCard: Schema = {
      type: 'ElCard',
      props: { shadow: 'hover', header: `Card ${index} - Level 4`, style: 'margin: 4px;' },
      children: `Content ${index}`
    }
    for (let level = 3; level >= 0; level--) {
      innerCard = {
        type: 'ElCard',
        props: { shadow: 'hover', header: `Card ${index} - Level ${level}`, style: 'margin: 4px;' },
        children: [innerCard]
      }
    }
    return innerCard
  }
  
  return {
    type: 'div',
    props: { style: 'padding: 16px; display: flex; flex-wrap: wrap; gap: 8px;' },
    children: Array.from({ length: componentCount }, (_, i) => createNestedCard(i))
  }
}
