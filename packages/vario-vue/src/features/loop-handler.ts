/**
 * 循环处理模块
 *
 * 负责处理 Schema 中的循环渲染；支持 parentMap / nodeContext 供事件中 $parent 使用。
 * 可选列表项组件化（loopItemAsComponent）：每项独立 Vue 组件，仅该项 props 变化时 re-render。
 */

import { h, Fragment, type VNode } from 'vue'
import type { RuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
import { createLoopContext, type PathSegment } from '@variojs/core'
import type { ModelPathResolver } from './path-resolver.js'
import type { ParentMap } from './node-context.js'
import { LoopItemCell } from './loop-item-cell.js'

export type CreateVNodeFn = (
  schema: SchemaNode,
  ctx: RuntimeContext,
  modelPathStack?: PathSegment[],
  nodeContext?: { parent?: SchemaNode; siblings?: SchemaNode[]; selfIndex?: number; path?: string },
  parentMap?: ParentMap,
  path?: string
) => VNode | null

export type RenderNodeForLoopItemFn = (
  schema: SchemaNode,
  ctx: RuntimeContext,
  modelPathStack: PathSegment[],
  nodeContext: { parent?: SchemaNode; siblings?: SchemaNode[]; selfIndex?: number; path?: string } | undefined,
  path: string
) => VNode | null

/**
 * 循环处理器
 */
export class LoopHandler {
  constructor(
    private pathResolver: ModelPathResolver,
    private createVNode: CreateVNodeFn,
    private evaluateExpr: (expr: string, ctx: RuntimeContext) => any,
    private loopItemAsComponent: boolean = false,
    private getRenderNodeForLoopItem?: (parentMap: ParentMap) => RenderNodeForLoopItemFn
  ) {}

  /**
   * 创建循环渲染的 VNode
   * @param parentMap 节点→父节点映射，循环项父节点为带 loop 的 schema
   * @param parentPath 父节点 path，供 path-memo 子项 path 使用（如 "0.[1]"）
   */
  createLoopVNode(
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = [],
    parentMap?: ParentMap,
    parentPath: string = ''
  ): VNode | null {
    const { loop } = schema
    if (!loop) {
      return null
    }

    // 解析循环数据源路径
    const itemsPath = this.pathResolver.extractModelPath(loop.items)
    
    // 解析循环数据源（错误处理）
    let items: any[]
    try {
      const evaluated = this.evaluateExpr(itemsPath, ctx)
      
      if (!Array.isArray(evaluated)) {
        // 非数组，返回错误提示
        return h('div', { 
          style: 'color: red; padding: 10px;' 
        }, `Loop items must be an array, got: ${typeof evaluated}`)
      }
      
      items = evaluated
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return h('div', { 
        style: 'color: red; padding: 10px;' 
      }, `Loop items evaluation error: ${errorMessage}`)
    }

    if (items.length === 0) {
      // 空数组，返回 null
      return null
    }
    
    // 处理循环节点自身的 model 属性（如 model: 'users' 或 model: { path: 'users', scope: true }）
    let basePathStack = [...modelPathStack]
    const scopePath = this.pathResolver.getScopePath(schema.model)
    if (scopePath) {
      basePathStack = this.pathResolver.updateModelPathStack(
        scopePath,
        modelPathStack,
        ctx,
        schema
      )
    }

    const useLoopItemComponent =
      this.loopItemAsComponent &&
      this.getRenderNodeForLoopItem != null &&
      parentMap != null
    const renderNodeForItem = useLoopItemComponent
      ? this.getRenderNodeForLoopItem!(parentMap!)
      : null

    // 创建循环子节点（优化：稳定的key生成）
    const children = items
      .map((item: any, index: number) => {
        try {
          // 创建子节点 schema（排除 loop 和已处理的 model 属性）
          const childSchema = { ...schema }
          delete (childSchema as any).loop
          const modelPathVal = this.pathResolver.getModelPath(schema.model)
          if (modelPathVal) {
            const extracted = this.pathResolver.extractModelPath(modelPathVal)
            if (extracted === itemsPath) {
              delete (childSchema as any).model
            }
          }
          this.markLoopSchema(childSchema, loop.items)

          const loopPathStack: PathSegment[] = [...basePathStack, index]
          const itemPath = parentPath ? `${parentPath}.[${index}]` : `[${index}]`
          const keyValue = this.getLoopItemKey(item, loop.itemKey, index)

          if (useLoopItemComponent && renderNodeForItem) {
            return h(LoopItemCell, {
              key: keyValue,
              item,
              index,
              childSchema,
              parentSchema: schema,
              parentCtx: ctx,
              modelPathStack: basePathStack,
              parentPath,
              itemPath,
              itemKey: loop.itemKey,
              indexKey: loop.indexKey,
              loop,
              renderNode: renderNodeForItem,
              getLoopItemKey: (i: any, k: string, idx: number) => this.getLoopItemKey(i, k, idx)
            })
          }

          if (parentMap != null) {
            parentMap.set(childSchema, schema)
          }
          const loopCtx = createLoopContext(ctx, item, index)
          ;(loopCtx as Record<string, unknown>)[loop.itemKey] = item
          if (loop.indexKey) {
            ;(loopCtx as Record<string, unknown>)[loop.indexKey] = index
          }
          const vnode = this.createVNode(childSchema, loopCtx, loopPathStack, {
            parent: schema,
            siblings: [],
            selfIndex: index,
            path: itemPath
          }, parentMap, itemPath)
          if (vnode && typeof vnode === 'object' && 'key' in vnode) {
            ;(vnode as any).key = keyValue
          }
          return vnode
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.warn(`Loop item render error at index ${index}:`, errorMessage)
          return h('div', {
            key: `error-${index}`,
            style: 'color: red; padding: 5px;'
          }, `Render error: ${errorMessage}`)
        }
      })
      .filter((vnode: any) => vnode !== null && vnode !== undefined)

    // 如果所有子节点都无效，返回 null
    if (children.length === 0) {
      return null
    }

    // 使用 Fragment 包裹循环节点
    return h(Fragment, null, children)
  }

  /**
   * 递归标记 schema 及其所有子节点的 __loopItems
   * 确保嵌套子节点中的 model 绑定也能正确解析循环变量
   */
  private markLoopSchema(schema: SchemaNode, loopItems: string): void {
    // 设置当前节点
    (schema as any).__loopItems = loopItems
    
    // 递归处理 children
    if (schema.children) {
      if (Array.isArray(schema.children)) {
        schema.children.forEach(child => {
          // 检查是否是 SchemaNode（有 type 属性的对象，但不是数组）
          if (child && typeof child === 'object' && !Array.isArray(child) && 'type' in child) {
            this.markLoopSchema(child as unknown as SchemaNode, loopItems)
          }
        })
      } else if (typeof schema.children === 'object' && !Array.isArray(schema.children) && 'type' in (schema.children as object)) {
        this.markLoopSchema(schema.children as unknown as SchemaNode, loopItems)
      }
    }
  }

  /**
   * 获取循环项的稳定key
   * 
   * 策略：
   * 1. 如果item是对象且有itemKey指定的属性，使用该属性值
   * 2. 如果item有id属性，使用id
   * 3. 否则使用index（不理想，但作为后备）
   */
  private getLoopItemKey(item: any, itemKey: string, index: number): string | number {
    // 尝试从item中获取key值
    if (item && typeof item === 'object') {
      // 优先使用itemKey指定的属性
      if (itemKey in item && item[itemKey] != null) {
        const keyValue = item[itemKey]
        // 确保key是字符串或数字
        if (typeof keyValue === 'string' || typeof keyValue === 'number') {
          return keyValue
        }
      }
      
      // 后备：使用id属性
      if ('id' in item && item.id != null) {
        const idValue = item.id
        if (typeof idValue === 'string' || typeof idValue === 'number') {
          return idValue
        }
      }
    }
    
    // 最后使用index（不理想，但作为后备）
    return index
  }
}
