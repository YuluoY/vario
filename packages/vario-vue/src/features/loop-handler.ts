/**
 * 循环处理模块
 * 
 * 负责处理 Schema 中的循环渲染
 */

import { h, Fragment, type VNode } from 'vue'
import type { RuntimeContext } from '@vario/core'
import type { SchemaNode } from '@vario/schema'
import { createLoopContext, type PathSegment } from '@vario/core'
import type { ModelPathResolver } from './path-resolver.js'

/**
 * 循环处理器
 */
export class LoopHandler {
  constructor(
    private pathResolver: ModelPathResolver,
    private createVNode: (
      schema: SchemaNode,
      ctx: RuntimeContext,
      modelPathStack: PathSegment[]
    ) => VNode | null,
    private evaluateExpr: (expr: string, ctx: RuntimeContext) => any
  ) {}

  /**
   * 创建循环渲染的 VNode
   */
  createLoopVNode(
    schema: SchemaNode,
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = []
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
    
    // 处理循环节点自身的 model 属性（如 model: 'users' 同时有 loop）
    // 这种情况下，路径栈需要先更新为 model 的路径
    let basePathStack = [...modelPathStack]
    if (schema.model) {
      basePathStack = this.pathResolver.updateModelPathStack(
        schema.model as string,
        modelPathStack,
        ctx,
        schema
      )
    }

    // 创建循环子节点（优化：稳定的key生成）
    const children = items
      .map((item: any, index: number) => {
        try {
          // 创建循环上下文（使用 Object.create 保持原型链，继承 _get/_set 等方法）
          const loopCtx = createLoopContext(ctx, item, index)
          
          // 设置 itemKey 对应的变量名
          loopCtx[loop.itemKey] = item

          // 添加indexKey（如果指定）
          if (loop.indexKey) {
            loopCtx[loop.indexKey] = index
          }

          // 创建子节点（排除 loop 和已处理的 model 属性，避免递归和重复处理）
          const childSchema = { ...schema }
          delete (childSchema as any).loop
          // 如果 schema.model 和 loop.items 路径相同（如 model: 'users' 配合 loop: { items: '{{ users }}' }），
          // 需要删除 model，因为循环节点的 model 已经在 createLoopVNode 中处理到 basePathStack 中了
          if (schema.model) {
            const modelPath = this.pathResolver.extractModelPath(schema.model as string)
            if (modelPath === itemsPath) {
              delete (childSchema as any).model
            }
          }
          
          // 递归设置 __loopItems 到所有子节点，确保 model 绑定可以正确解析
          this.markLoopSchema(childSchema, loop.items)

          // 循环中的路径栈处理：
          // 将循环索引加入路径栈，子级的扁平路径会拼接到这个路径上
          // 例如：basePathStack = ['users'], index = 0
          //       loopPathStack = ['users', 0]
          //       子级 model: 'name' → 'users.0.name'
          const loopPathStack: PathSegment[] = [...basePathStack, index]
          
          const vnode = this.createVNode(childSchema, loopCtx, loopPathStack)
          
          // 生成稳定的key（基于itemKey或index）
          if (vnode && typeof vnode === 'object' && 'key' in vnode) {
            const keyValue = this.getLoopItemKey(item, loop.itemKey, index)
            ;(vnode as any).key = keyValue
          }
          
          return vnode
        } catch (error) {
          // 单个项渲染错误，返回错误节点
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
