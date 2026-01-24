/**
 * Model 路径解析模块
 * 
 * 负责处理 model 路径的解析、拼接和转换
 */

import type { RuntimeContext } from '@variojs/core'
import type { SchemaNode } from '@variojs/schema'
import { parsePath, type PathSegment } from '@variojs/core'
import type { ModelPathConfig } from '../renderer.js'

/**
 * Model 路径解析器
 */
export class ModelPathResolver {
  constructor(
    private config: ModelPathConfig,
    private evaluateExpr: (expr: string, ctx: RuntimeContext) => any
  ) {}

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
    
    if (isFlatPath && this.config.autoResolve && modelPathStack.length > 0) {
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
