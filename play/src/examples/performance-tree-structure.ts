import type { Schema } from '@vario/schema'

/**
 * 树形结构场景
 * 创建 componentCount 个树节点，每个节点有 3 层子节点
 * 线性增长，避免指数级内存消耗
 */
export const createTreeStructureSchema = (componentCount: number): Schema => {
  const treeDepth = 3
  
  const createTreeNode = (index: number, level: number = 0): Schema => {
    return {
      type: 'div',
      props: { 
        style: `padding: 8px; margin-left: ${level * 20}px; border-left: 2px solid #409eff; margin-bottom: 4px;`,
        class: `tree-level-${level}`
      },
      children: [
        {
          type: 'ElTag',
          props: { type: level === 0 ? 'primary' : level === 1 ? 'success' : 'warning' },
          children: `Node ${index} - L${level}`
        },
        ...(level < treeDepth ? [createTreeNode(index, level + 1)] : [])
      ]
    }
  }
  
  return {
    type: 'div',
    props: { style: 'padding: 16px;' },
    children: Array.from({ length: componentCount }, (_, i) => createTreeNode(i))
  }
}
