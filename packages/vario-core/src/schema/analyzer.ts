/**
 * Schema 分析器 - 框架无关的纯函数实现
 * 
 * 提供 Schema 统计和索引构建能力，不依赖任何前端框架
 */

import type { SchemaNode } from '@variojs/types'
import { traverseSchema } from '../runtime/traversal.js'

/**
 * Schema 统计信息
 */
export interface SchemaStats {
  /** 节点总数 */
  nodeCount: number
  /** 最大深度 */
  maxDepth: number
}

/**
 * Schema 索引映射
 */
export interface SchemaIndex {
  /** ID -> 路径的映射 */
  idMap: Map<string, string>
  /** 路径 -> 节点的映射（可选，用于快速访问） */
  pathMap?: Map<string, SchemaNode>
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  stats: SchemaStats
  index: SchemaIndex
}

/**
 * 分析 Schema 结构
 * 
 * 遍历整个 Schema 树，收集统计信息和构建索引
 * 
 * @param schema 要分析的 Schema 根节点
 * @param options 分析选项
 * @returns 分析结果
 */
export function analyzeSchema(
  schema: SchemaNode,
  options: {
    /** 是否构建路径映射（会增加内存开销） */
    buildPathMap?: boolean
    /** 自定义回调，在遍历每个节点时调用 */
    onNode?: (node: SchemaNode, path: string, depth: number) => void
  } = {}
): AnalysisResult {
  const stats: SchemaStats = {
    nodeCount: 0,
    maxDepth: 0
  }

  const idMap = new Map<string, string>()
  const pathMap = options.buildPathMap ? new Map<string, SchemaNode>() : undefined

  traverseSchema(schema, (node: SchemaNode, path: string, depth: number) => {
    // 统计
    stats.nodeCount++
    if (depth > stats.maxDepth) {
      stats.maxDepth = depth
    }

    // 构建 ID 索引
    const nodeWithId = node as any
    if (nodeWithId.id && typeof nodeWithId.id === 'string') {
      idMap.set(nodeWithId.id, path)
    }

    // 构建路径映射（可选）
    if (pathMap) {
      pathMap.set(path, node)
    }

    // 用户自定义回调
    options.onNode?.(node, path, depth)
  })

  return {
    stats,
    index: { idMap, pathMap }
  }
}

/**
 * 在 Schema 中查找节点
 * 
 * @param schema Schema 根节点
 * @param predicate 判断条件
 * @returns 匹配的节点路径数组
 */
export function findNodes(
  schema: SchemaNode,
  predicate: (node: SchemaNode) => boolean
): Array<{ node: SchemaNode; path: string }> {
  const results: Array<{ node: SchemaNode; path: string }> = []

  traverseSchema(schema, (node: SchemaNode, path: string) => {
    if (predicate(node)) {
      results.push({ node, path })
    }
  })

  return results
}

/**
 * 在 Schema 中查找第一个匹配的节点
 * 
 * @param schema Schema 根节点
 * @param predicate 判断条件
 * @returns 匹配的节点和路径，如果未找到返回 null
 */
export function findNode(
  schema: SchemaNode,
  predicate: (node: SchemaNode) => boolean
): { node: SchemaNode; path: string } | null {
  let result: { node: SchemaNode; path: string } | null = null

  traverseSchema(schema, (node: SchemaNode, path: string) => {
    if (predicate(node)) {
      result = { node, path }
      return false // 停止遍历
    }
    return undefined // 继续遍历
  })

  return result
}

/**
 * 通过 ID 查找节点路径
 * 
 * @param schema Schema 根节点
 * @param id 节点 ID
 * @returns 节点路径，如果未找到返回 null
 */
export function findPathById(schema: SchemaNode, id: string): string | null {
  const result = findNode(schema, (node) => (node as any).id === id)
  return result?.path || null
}
