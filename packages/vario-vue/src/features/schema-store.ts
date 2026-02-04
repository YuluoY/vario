/**
 * 方案 D：Schema 按 path 碎片化
 *
 * 核心思路：
 * - 不再用一棵 reactive(schema) 大树，而是维护 path → reactive(node) 的映射
 * - 改某 path 的 node 只触发依赖该 path 的 effect
 * - 为 path-memo 或子树组件化提供「精确失效」的数据基础
 *
 * 用户 API 不变，内部实现优化
 */

import { shallowReactive, toRaw } from 'vue'
import type { SchemaNode } from '@variojs/schema'

/**
 * Schema 碎片存储
 * path → reactive(node) 映射
 */
export interface SchemaStore {
  /** 根据 path 获取节点（返回 reactive 节点） */
  get(path: string): SchemaNode | undefined
  /** 设置节点（自动创建 reactive） */
  set(path: string, node: SchemaNode): void
  /** 删除节点 */
  delete(path: string): void
  /** 检查节点是否存在 */
  has(path: string): boolean
  /** 获取所有路径 */
  keys(): string[]
  /** 清空存储 */
  clear(): void
  /** 获取根节点 */
  getRoot(): SchemaNode | undefined
  /** 从完整 schema 树初始化 */
  fromTree(schema: SchemaNode): void
  /** 还原为完整 schema 树 */
  toTree(): SchemaNode | undefined
  /** Patch 某个 path 的节点（触发精确更新） */
  patch(path: string, partialNode: Partial<SchemaNode>): void
  /** 获取节点的子节点路径 */
  getChildPaths(path: string): string[]
  /** 获取版本号（用于检测变化） */
  getVersion(path: string): number
  /** 触发路径更新（手动通知依赖方） */
  trigger(path: string): void
}

/**
 * 路径工具函数
 */
export function joinPath(parent: string, index: number | string): string {
  if (parent === '') return String(index)
  return `${parent}.${index}`
}

export function getParentPath(path: string): string {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return ''
  return path.substring(0, lastDot)
}

export function getLastSegment(path: string): string {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return path
  return path.substring(lastDot + 1)
}

/**
 * 创建 Schema 碎片存储
 */
export function createSchemaStore(): SchemaStore {
  // path → reactive(node) 映射
  const nodes = shallowReactive<Map<string, SchemaNode>>(new Map())
  // path → version 版本号（用于精确失效检测）
  const versions = shallowReactive<Map<string, number>>(new Map())
  // path → childPaths 子节点路径缓存
  const childPathsCache = new Map<string, string[]>()

  /**
   * 递归遍历 schema 树，将每个节点存入 store
   */
  function walkTree(node: SchemaNode, path: string): void {
    // 创建节点的浅响应式副本（保留原始引用结构）
    const reactiveNode = shallowReactive({ ...node })
    nodes.set(path, reactiveNode)
    versions.set(path, 0)

    // 处理 children
    if (node.children) {
      const childPaths: string[] = []
      if (Array.isArray(node.children)) {
        node.children.forEach((child, index) => {
          if (child && typeof child === 'object' && 'type' in child) {
            const childPath = joinPath(path, index)
            childPaths.push(childPath)
            walkTree(child as SchemaNode, childPath)
          }
        })
      } else if (typeof node.children === 'object' && 'type' in node.children) {
        // 单个子节点
        const childPath = joinPath(path, 0)
        childPaths.push(childPath)
        walkTree(node.children as unknown as SchemaNode, childPath)
      }
      childPathsCache.set(path, childPaths)
    }
  }

  /**
   * 从碎片还原为树结构
   */
  function rebuildTree(path: string): SchemaNode | undefined {
    const node = nodes.get(path)
    if (!node) return undefined

    // 深拷贝节点（避免修改 store 中的响应式对象）
    const result = { ...toRaw(node) } as Record<string, unknown>

    // 重建 children
    const childPaths = childPathsCache.get(path)
    if (childPaths && childPaths.length > 0) {
      const children: SchemaNode[] = []
      for (const childPath of childPaths) {
        const child = rebuildTree(childPath)
        if (child) {
          children.push(child)
        }
      }
      if (children.length === 1 && !Array.isArray(node.children)) {
        result.children = children[0]
      } else if (children.length > 0) {
        result.children = children
      }
    }

    return result as SchemaNode
  }

  return {
    get(path: string): SchemaNode | undefined {
      return nodes.get(path)
    },

    set(path: string, node: SchemaNode): void {
      const reactiveNode = shallowReactive({ ...node })
      nodes.set(path, reactiveNode)
      versions.set(path, (versions.get(path) ?? 0) + 1)
    },

    delete(path: string): void {
      // 递归删除子节点
      const childPaths = childPathsCache.get(path)
      if (childPaths) {
        for (const childPath of childPaths) {
          this.delete(childPath)
        }
        childPathsCache.delete(path)
      }
      nodes.delete(path)
      versions.delete(path)
    },

    has(path: string): boolean {
      return nodes.has(path)
    },

    keys(): string[] {
      return Array.from(nodes.keys())
    },

    clear(): void {
      nodes.clear()
      versions.clear()
      childPathsCache.clear()
    },

    getRoot(): SchemaNode | undefined {
      return nodes.get('')
    },

    fromTree(schema: SchemaNode): void {
      this.clear()
      walkTree(schema, '')
    },

    toTree(): SchemaNode | undefined {
      return rebuildTree('')
    },

    patch(path: string, partialNode: Partial<SchemaNode>): void {
      const node = nodes.get(path)
      if (!node) return

      // 合并更新
      Object.assign(node, partialNode)
      // 更新版本号
      versions.set(path, (versions.get(path) ?? 0) + 1)
    },

    getChildPaths(path: string): string[] {
      return childPathsCache.get(path) ?? []
    },

    getVersion(path: string): number {
      return versions.get(path) ?? 0
    },

    trigger(path: string): void {
      // 更新版本号以触发依赖更新
      versions.set(path, (versions.get(path) ?? 0) + 1)
    }
  }
}

/**
 * Schema 碎片化选项
 */
export interface SchemaFragmentOptions {
  /** 是否启用碎片化（默认 false，需显式开启） */
  enabled?: boolean
  /** 碎片粒度：'node' 每个节点 | 'component' 仅组件边界 */
  granularity?: 'node' | 'component'
}

/**
 * 判断节点是否为组件边界（用于 granularity: 'component'）
 */
export function isComponentBoundary(node: SchemaNode): boolean {
  // 组件边界条件：
  // 1. 有 loop（循环节点自成边界）
  // 2. 有生命周期钩子
  // 3. 有 provide/inject
  // 4. 是自定义组件（非原生 HTML 标签）
  const type = node.type
  const isCustomComponent = typeof type === 'string' && /^[A-Z]/.test(type)
  const hasLoop = !!node.loop
  const vueNode = node as { onMounted?: unknown; provide?: unknown; inject?: unknown }
  const hasLifecycle = !!(vueNode.onMounted || vueNode.provide || vueNode.inject)

  return isCustomComponent || hasLoop || hasLifecycle
}

/**
 * 创建路径到节点的快速查找映射（用于渲染优化）
 */
export function createPathLookup(schema: SchemaNode): Map<string, SchemaNode> {
  const lookup = new Map<string, SchemaNode>()

  function walk(node: SchemaNode, path: string): void {
    lookup.set(path, node)

    if (node.children) {
      if (Array.isArray(node.children)) {
        node.children.forEach((child, index) => {
          if (child && typeof child === 'object' && 'type' in child) {
            walk(child as SchemaNode, joinPath(path, index))
          }
        })
      } else if (typeof node.children === 'object' && 'type' in node.children) {
        walk(node.children as unknown as SchemaNode, joinPath(path, 0))
      }
    }
  }

  walk(schema, '')
  return lookup
}
