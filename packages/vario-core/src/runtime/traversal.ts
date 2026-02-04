
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
  ) {
    if (!node || typeof node !== 'object') return

    // 执行回调，如果返回 false 则停止遍历当前分支的子节点
    const shouldContinue = callback(node, path, depth, parent)
    if (shouldContinue === false) return

    // 处理 children (Schema 树结构)
    // 根据 Vario Schema 定义，主要是 children 属性
    if (node.children) {
      if (Array.isArray(node.children)) {
        node.children.forEach((child: any, index: number) => {
          if (child && typeof child === 'object') {
             const childPath = path ? `${path}${separator}children${separator}${index}` : `children${separator}${index}`
             walk(child as SchemaNode, childPath, depth + 1, node)
          } 
          // ignore string children as they are text content
        })
      } else if (typeof node.children === 'object') {
         // 虽然类型定义说 children 是 array | string，但防御性处理单对象情况
         const childPath = path ? `${path}${separator}children` : `children`
         walk(node.children as unknown as SchemaNode, childPath, depth + 1, node)
      }
    }
  }

  // 从根开始
  walk(root, '', 0, null)
}
