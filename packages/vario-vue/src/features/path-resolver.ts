/**
 * Model 路径解析模块
 * 
 * 负责处理 model 路径的解析、拼接和转换
 */

import type { RuntimeContext, PathSegment, ModelModifiers } from '@variojs/types'
import type { SchemaNode } from '@variojs/schema'
import { parsePath } from '@variojs/core'

/**
 * Model 路径解析器
 */
export class ModelPathResolver {
  constructor(private evaluateExpr: (expr: string, ctx: RuntimeContext) => any) {}

  /**
   * 从 model（string | { path, scope? }）中取出路径字符串
   */
  getModelPath(model: unknown): string | undefined {
    if (model == null) return undefined
    if (typeof model === 'string') return model
    if (typeof model === 'object' && model !== null && typeof (model as { path?: string }).path === 'string') {
      return (model as { path: string }).path
    }
    return undefined
  }

  /**
   * 返回应压栈的路径：string 返回 path；object 且 scope 时返回 path；否则 undefined
   */
  getScopePath(model: unknown): string | undefined {
    const path = this.getModelPath(model)
    if (!path) return undefined
    if (typeof model === 'string') return path
    return (model as { scope?: boolean }).scope ? path : undefined
  }

  /**
   * 从 model（string | { path, scope?, default? }）中取出默认值，仅对象形式且含 default 时有值
   */
  getModelDefault(model: unknown): unknown {
    if (model == null || typeof model !== 'object') return undefined
    return (model as { default?: unknown }).default
  }

  /**
   * 获取 model 的修饰符
   * @returns 修饰符对象 { trim: true, lazy: true, number: true }
   */
  getModelModifiers(model: unknown): Record<string, boolean> {
    if (model == null || typeof model !== 'object') return {}
    const modifiers = (model as { modifiers?: ModelModifiers }).modifiers
    if (!modifiers) return {}
    
    // 如果是数组，转换为对象
    if (Array.isArray(modifiers)) {
      const result: Record<string, boolean> = {}
      modifiers.forEach(m => { result[m] = true })
      return result
    }
    
    return modifiers as Record<string, boolean>
  }

  /**
   * 更新 model 路径栈
   * 
   * 根据当前节点的 model 属性更新路径栈，供子级使用。
   * 支持 [] 语法明确数组访问。
   */
  updateModelPathStack(
    modelPath: string | undefined,
    parentStack: PathSegment[],
    ctx: RuntimeContext,
    schema: SchemaNode
  ): PathSegment[] {
    if (!modelPath) {
      return [...parentStack]
    }
    
    // 提取路径（去除 {{ }}）
    const rawPath = this.extractModelPath(modelPath)
    
    // 解析路径段（支持 [] 语法）
    const segments = parsePath(rawPath)
    
    if (segments.length === 0) {
      return [...parentStack]
    }
    
    // 判断是否为单段路径（扁平路径）
    const isFlatPath = segments.length === 1 && typeof segments[0] === 'string'
    
    if (isFlatPath) {
      // 扁平路径：拼接到父级路径栈
      return [...parentStack, segments[0]]
    }
    
    // 多段路径（明确路径）
    // 检查是否在循环上下文中引用了循环变量
    const firstSegment = segments[0]
    if (ctx.$index !== undefined && typeof firstSegment === 'string') {
      // 检查是否是循环变量（$item 或 itemKey）
      if (firstSegment === '$item' || (firstSegment in ctx && ctx[firstSegment] === ctx.$item)) {
        // 获取循环的 items 路径
        const loopItems = (schema as any).__loopItems
        if (loopItems) {
          const itemsPath = this.extractModelPath(loopItems)
          const itemsSegments = parsePath(itemsPath)
          const restSegments = segments.slice(1)  // 移除 item/$item
          // 构建完整路径：itemsPath + 索引 + 剩余路径
          return [...itemsSegments, ctx.$index, ...restSegments]
        }
      }
    }
    
    // 处理动态索引（-1 表示需要在循环上下文中填充）
    const resolvedSegments = segments.map(seg => {
      if (seg === -1 && ctx.$index !== undefined) {
        return ctx.$index
      }
      return seg
    })
    
    // 明确路径：作为新的路径栈基础
    return resolvedSegments
  }
  
  /**
   * 提取 model 路径（去除 {{ }} 包裹）
   */
  extractModelPath(modelPath: string): string {
    if (typeof modelPath !== 'string') {
      return String(modelPath)
    }
    return modelPath.includes('{{')
      ? modelPath.replace(/^\{\{\s*|\s*\}\}$/g, '').trim()
      : modelPath
  }
  
  /**
   * 解析 model 路径为最终的状态路径
   * 
   * 支持：
   * - 当前栈路径：`model: "."` 且路径栈非空时 → 返回栈对应路径（用于循环中绑定 items[0]、items[1] 等数组元素本身）
   * - 扁平路径：`name` → 拼接路径栈 → `form.user.name`
   * - 明确路径：`form.user.name` → 直接使用
   * - 数组访问：`users[0].name` → 解析为 `users.0.name`
   * - 循环变量：`item.name` → 解析为 `items.0.name`
   */
  resolveModelPath(
    modelPath: string, 
    schema: SchemaNode, 
    ctx: RuntimeContext,
    modelPathStack: PathSegment[] = []
  ): string {
    if (typeof modelPath !== 'string') {
      return String(modelPath)
    }
    
    // 提取路径
    const rawPath = this.extractModelPath(modelPath)
    
    // 如果是表达式，先求值
    if (modelPath.includes('{{')) {
      const evaluated = this.evaluateExpr(rawPath, ctx)
      if (typeof evaluated === 'string' && evaluated !== rawPath) {
        // 递归处理求值后的路径
        return this.resolveModelPath(evaluated, schema, ctx, modelPathStack)
      }
    }
    
    // model 为 "." 表示绑定到「当前路径栈」对应路径（循环中即当前项 items[i]，数组元素本身）
    if ((rawPath === '.' || rawPath === '') && modelPathStack.length > 0) {
      return this.segmentsToPath(modelPathStack)
    }
    
    // 解析路径段
    const segments = parsePath(rawPath)
    
    if (segments.length === 0) {
      return rawPath
    }
    
    // 处理循环上下文中的变量引用
    const firstSegment = segments[0]
    if (ctx.$index !== undefined && typeof firstSegment === 'string') {
      // 检查是否是循环变量
      if (firstSegment === '$item' || (firstSegment in ctx && ctx[firstSegment] === ctx.$item)) {
        const loopItems = (schema as any).__loopItems
        if (loopItems) {
          const itemsPath = this.extractModelPath(loopItems)
          const itemsSegments = parsePath(itemsPath)
          const restSegments = segments.slice(1)
          const fullSegments = [...itemsSegments, ctx.$index, ...restSegments]
          return this.segmentsToPath(fullSegments)
        }
      }
    }
    
    // 判断是否为扁平路径（单段且为字符串）
    const isFlatPath = segments.length === 1 && typeof segments[0] === 'string'
    
    if (isFlatPath && modelPathStack.length > 0) {
      // 扁平路径：拼接路径栈
      const fullSegments = [...modelPathStack, segments[0]]
      return this.segmentsToPath(fullSegments)
    }
    
    // 处理动态索引
    const resolvedSegments = segments.map(seg => {
      if (seg === -1 && ctx.$index !== undefined) {
        return ctx.$index
      }
      return seg
    })
    
    return this.segmentsToPath(resolvedSegments)
  }
  
  /**
   * 将路径段数组转换为路径字符串
   */
  segmentsToPath(segments: PathSegment[]): string {
    return segments.map(String).join('.')
  }
}
