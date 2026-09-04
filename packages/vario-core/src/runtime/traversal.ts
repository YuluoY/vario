
import type { SchemaNode } from '@variojs/types'

export type TraversalCallback = (
  node: SchemaNode,
  path: string,
  depth: number,
  parent: SchemaNode | null
) => boolean | void // return false to stop

/**
 * 通用 Schema 遍历工具 (UI Component Tree 风格)
 * 采用深度优先遍历 (DFS)
 * 
 * @param root 根节点
 * @param callback 回调函数
 * @param separator 路径分隔符，默认为 '.'
 */
export function traverseSchema(
  root: SchemaNode,
  callback: TraversalCallback,
  separator: string = '.'
): void {
  
  function walk(
    node: SchemaNode,
    path: string,
    depth: number,
    parent: SchemaNode | null
  ): boolean | void {
    if (!node || typeof node !== 'object') return

    const shouldContinue = callback(node, path, depth, parent)
    if (shouldContinue === false) return false

    // 处理 children (Schema 树结构)
    // 根据 Vario Schema 定义，主要是 children 属性
    if (node.children) {
      if (Array.isArray(node.children)) {
        for (let index = 0; index < node.children.length; index++) {
          const child = node.children[index] as unknown
          if (child && typeof child === 'object') {
            const childPath = path ? `${path}${separator}children${separator}${index}` : `children${separator}${index}`
            if (walk(child as SchemaNode, childPath, depth + 1, node) === false) return false
          }
        }
      } else if (typeof node.children === 'object') {
        const childPath = path ? `${path}${separator}children` : `children`
        if (walk(node.children as unknown as SchemaNode, childPath, depth + 1, node) === false) return false
      }
    }
  }

  // 从根开始
  walk(root, '', 0, null)
}
