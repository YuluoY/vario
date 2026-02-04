/**
 * Schema 查询引擎 - 框架无关的查询 API
 */

import type { SchemaNode } from '@variojs/types'
import { getPathValue } from '../runtime/path.js'
import type { SchemaIndex } from './analyzer.js'

/**
 * 查询引擎配置
 */
export interface QueryEngineOptions {
  /** Schema 根节点 */
  schema: SchemaNode
  /** 索引（可选，用于加速 ID 查询） */
  index?: SchemaIndex
}

/**
 * 节点查询结果
 */
export interface NodeResult {
  /** 节点对象 */
  node: SchemaNode
  /** 节点路径 */
  path: string
}

/**
 * 创建查询引擎
 * 
 * 提供高性能的 Schema 查询能力
 */
export function createQueryEngine(options: QueryEngineOptions) {
  const { schema, index } = options

  /**
   * 通过 ID 查找节点
   */
  const findById = (id: string): NodeResult | null => {
    // 如果有索引，使用索引查找（O(1)）
    if (index?.idMap) {
      const path = index.idMap.get(id)
      if (!path) return null

      // 如果有 pathMap，直接返回
      if (index.pathMap) {
        const node = index.pathMap.get(path)
        return node ? { node, path } : null
      }

      // 否则通过路径获取节点
      const node = getPathValue(schema, path) as SchemaNode
      return node ? { node, path } : null
    }

    // 没有索引，需要遍历查找（回退方案）
    return null
  }

  /**
   * 获取节点的父节点
   */
  const getParent = (path: string): NodeResult | null => {
    if (!path) {
      return null // Root has no parent
    }

    // 如果路径不包含 . (顶层节点)，返回根节点
    if (!path.includes('.')) {
      return null // Invalid path for top-level
    }

    let currentPath = path
    
    while (true) {
      const lastDot = currentPath.lastIndexOf('.')
      if (lastDot === -1) {
        // 已经到达根级别，返回根节点
        return { node: schema, path: '' }
      }
      
      currentPath = currentPath.substring(0, lastDot)
      
      const lastSegment = currentPath.split('.').pop()
      
      // 跳过容器属性 (根据 Vario Schema 主要是 children)
      if (lastSegment && ['children', 'definitions', 'items'].includes(lastSegment)) {
        continue
      }
      
      const node = getPathValue(schema, currentPath) as any
      
      // 跳过数组容器和字符串
      if (Array.isArray(node) || typeof node === 'string') {
        continue
      }
      
      if (node && typeof node === 'object') {
        return { node, path: currentPath }
      }
    }
  }

  return {
    findById,
    getParent
  }
}
