/**
 * Schema 查询引擎 - 框架无关的查询 API
 */

import type { SchemaNode } from '@variojs/types'
import { getPathValue } from '../runtime/path.js'
import { findNode } from './analyzer.js'
import type { SchemaIndex } from './analyzer.js'
import { ErrorCodes, VarioError } from '../errors.js'

/**
 * 查询引擎配置
 */
export interface QueryEngineOptions {
  /** Schema 根节点 */
  schema: SchemaNode
  /** 索引（可选，用于加速 ID 查询） */
  index?: SchemaIndex
  /** 只读文档不得 patch */
  readonly?: boolean
}

/**
 * 节点查询结果
 */
export interface NodeResult {
  /** 节点对象 */
  node: SchemaNode
  /** 节点路径 */
  path: string
  /** 原地 patch；只读输入抛 SCHEMA_READONLY */
  patch: (partial: Partial<SchemaNode>) => SchemaNode
}

/**
 * 创建查询引擎
 * 
 * 提供高性能的 Schema 查询能力
 */
function isReadonlyHost(schema: SchemaNode, node: SchemaNode, readonly?: boolean): boolean {
  return Boolean(readonly || Object.isFrozen(schema) || Object.isFrozen(node))
}

function attachPatch(
  schema: SchemaNode,
  result: { node: SchemaNode; path: string } | null,
  readonly?: boolean
): NodeResult | null {
  if (!result) return null
  return {
    node: result.node,
    path: result.path,
    patch(partial: Partial<SchemaNode>) {
      if (isReadonlyHost(schema, result.node, readonly)) {
        throw new VarioError('Schema is readonly', ErrorCodes.SCHEMA_READONLY, {
          schemaPath: result.path
        })
      }
      if (partial.props && result.node.props && typeof partial.props === 'object') {
        const mutable = result.node as SchemaNode & { props?: Record<string, unknown> }
        mutable.props = { ...result.node.props, ...(partial.props as object) }
        const rest = { ...partial }
        delete (rest as { props?: unknown }).props
        Object.assign(mutable, rest)
      } else {
        Object.assign(result.node, partial)
      }
      return result.node
    }
  }
}

export function createQueryEngine(options: QueryEngineOptions) {
  const { schema, index, readonly } = options

  /**
   * 通过 ID 查找节点
   */
  const findById = (id: string): NodeResult | null => {
    // 如果有索引，使用索引查找（O(1)）
    if (index?.idMap) {
      const path = index.idMap.get(id)
      if (path !== undefined) {
        if (index.pathMap) {
          const node = index.pathMap.get(path)
          return attachPatch(schema, node ? { node, path } : (path === '' ? { node: schema, path: '' } : null), readonly)
        }
        if (path === '') {
          return attachPatch(schema, { node: schema, path: '' }, readonly)
        }
        const node = getPathValue(schema, path) as SchemaNode
        return attachPatch(schema, node ? { node, path } : null, readonly)
      }
    }

    return attachPatch(schema, findNode(schema, (node) => (node as { id?: unknown }).id === id), readonly)
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
        return attachPatch(schema, { node: schema, path: '' }, readonly)
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
        return attachPatch(schema, { node, path: currentPath }, readonly)
      }
    }
  }

  return {
    findById,
    getParent
  }
}
