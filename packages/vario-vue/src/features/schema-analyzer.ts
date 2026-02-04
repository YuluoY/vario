
import { shallowRef, watch, type Ref, type ShallowRef, unref } from 'vue'
import type { SchemaNode } from '@variojs/schema'
import { 
  analyzeSchema as coreAnalyzeSchema,
  findNodes as coreFindNodes,
  type SchemaStats,
  type SchemaIndex
} from '@variojs/core'

export type { SchemaStats }

export interface SchemaAnalyzerOptions {
  /** 是否惰性分析（默认 true），仅在请求数据时才执行遍历 */
  lazy?: boolean
  /** 额外的分析回调 */
  onAnalyze?: (node: SchemaNode, path: string, depth: number) => void
}

export interface SchemaAnalyzer {
  /** 统计信息（响应式） */
  stats: ShallowRef<SchemaStats>
  /** 通过 ID 获取路径 */
  getPathById: (id: string) => string | undefined
  /** 通过条件查找所有节点路径 */
  findPaths: (predicate: (node: SchemaNode) => boolean) => string[]
  /** 强制重新分析 */
  refresh: () => void
}

/**
 * 创建 Schema 分析器（Vue 响应式版本）
 * 
 * 基于 @variojs/core 的纯函数实现，增加 Vue 响应式能力
 */
export function createSchemaAnalyzer(
  schemaRef: Ref<SchemaNode> | SchemaNode,
  options: SchemaAnalyzerOptions = {}
): SchemaAnalyzer {
  const stats = shallowRef<SchemaStats>({ nodeCount: 0, maxDepth: 0 })
  const indexRef = shallowRef<SchemaIndex>({ idMap: new Map() })
  const isDirty = shallowRef(true)

  // 惰性配置，默认为 true
  const isLazy = options.lazy !== false

  const analyze = () => {
    const root = unref(schemaRef)
    if (!root) {
      stats.value = { nodeCount: 0, maxDepth: 0 }
      indexRef.value = { idMap: new Map() }
      isDirty.value = false
      return
    }

    // 调用 core 层的纯函数分析
    const result = coreAnalyzeSchema(root, {
      buildPathMap: false, // 不需要 pathMap，节省内存
      onNode: options.onAnalyze
    })

    stats.value = result.stats
    indexRef.value = result.index
    isDirty.value = false
  }

  // 确保数据是最新的
  const ensureFresh = () => {
    if (isDirty.value) {
      analyze()
    }
  }

  // 监听 schema 变化
  if (typeof schemaRef === 'object' && 'value' in schemaRef) {
    watch(schemaRef, () => {
      isDirty.value = true
      if (!isLazy) {
        analyze()
      }
    }, { deep: true, immediate: !isLazy })
  } else if (!isLazy) {
    analyze()
  }

  return {
    stats,
    
    getPathById: (id: string) => {
      ensureFresh()
      return indexRef.value.idMap.get(id)
    },

    findPaths: (predicate: (node: SchemaNode) => boolean) => {
      const root = unref(schemaRef)
      if (!root) return []
      
      // 调用 core 层的查找函数
      const results = coreFindNodes(root, predicate)
      return results.map(r => r.path)
    },

    refresh: () => {
      isDirty.value = true
      analyze()
    }
  }
}
