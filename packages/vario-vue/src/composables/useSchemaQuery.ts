
import { unref, type Ref } from 'vue'
import type { SchemaNode } from '@variojs/schema'
import type { SchemaAnalyzer } from '../features/schema-analyzer.js'
import { getPathValue, createQueryEngine } from '@variojs/core'

export interface NodeWrapper {
  /** 当前节点的路径 */
  path: string
  /** 当前节点对象（响应式引用，如果源是响应式的） */
  node: SchemaNode
  /** Patch 修改节点 */
  patch: (partial: Partial<SchemaNode>) => void
  /** 访问特定属性 */
  get: (key: string) => any
  /** 父节点包装器 */
  parent: () => NodeWrapper | null
}

export interface SchemaQueryApi {
  /** 查找第一个匹配的节点 */
  find: (predicate: (node: SchemaNode) => boolean) => NodeWrapper | null
  /** 查找所有匹配的节点 */
  findAll: (predicate: (node: SchemaNode) => boolean) => NodeWrapper[]
  /** 通过 ID 查找节点 */
  findById: (id: string) => NodeWrapper | null
}

export interface SchemaQueryOptions {
  /** Vario patchNode 方法 */
  patchNode: (path: string, patch: Partial<SchemaNode>) => void
}

/**
 * Schema 查询 Hook（Vue 版本）
 * 
 * 基于 @variojs/core 的查询引擎，提供 Vue 友好的 API
 */
export function useSchemaQuery(
  schemaRef: Ref<SchemaNode> | SchemaNode,
  analyzer: SchemaAnalyzer,
  options: SchemaQueryOptions
): SchemaQueryApi {
  
  const getRoot = () => unref(schemaRef)

  const createWrapper = (path: string, node: SchemaNode): NodeWrapper => {
    return {
      path,
      node,
      patch: (partial) => {
        options.patchNode(path, partial)
      },
      get: (key) => node[key as keyof SchemaNode],
      parent: () => {
        const root = getRoot()
        const engine = createQueryEngine({ schema: root })
        const parentResult = engine.getParent(path)
        
        return parentResult ? createWrapper(parentResult.path, parentResult.node) : null
      }
    }
  }

  return {
    find: (predicate) => {
      const paths = analyzer.findPaths(predicate)
      if (paths.length === 0) return null
      
      const path = paths[0]
      const root = getRoot()
      const node = getPathValue(root, path) as SchemaNode
      return node ? createWrapper(path, node) : null
    },

    findAll: (predicate) => {
      const paths = analyzer.findPaths(predicate)
      const root = getRoot()
      
      return paths
        .map(path => {
          const node = getPathValue(root, path) as SchemaNode
          return node ? createWrapper(path, node) : null
        })
        .filter((w): w is NodeWrapper => w !== null)
    },

    findById: (id) => {
      const path = analyzer.getPathById(id)
      if (!path) return null
      
      const root = getRoot()
      const node = getPathValue(root, path) as SchemaNode
      return node ? createWrapper(path, node) : null
    }
  }
}
