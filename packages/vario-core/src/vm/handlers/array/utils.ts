/**
 * 数组指令工具函数
 */

import type { RuntimeContext } from '@variojs/types'
import { evaluate } from '@/expression/evaluate.js'

/**
 * 递归求值对象/数组中的表达式
 * 支持在对象属性和数组元素中使用 {{ expression }} 格式
 */
export function evaluateExpressionsRecursively(
  value: any,
  ctx: RuntimeContext
): any {
  // 字符串：检查是否为表达式
  if (typeof value === 'string') {
    if (value.startsWith('{{') && value.endsWith('}}')) {
      const expr = value.slice(2, -2).trim()
      return evaluate(expr, ctx)
    }
    return value
  }
  
  // 数组：递归处理每个元素
  if (Array.isArray(value)) {
    return value.map(item => evaluateExpressionsRecursively(item, ctx))
  }
  
  // 对象：递归处理每个属性值
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = evaluateExpressionsRecursively(val, ctx)
    }
    return result
  }
  
  // 其他类型：直接返回
  return value
}
