/**
 * 表达式工具函数
 * 
 * 提供表达式解析、格式化的通用工具
 * 支持 {{ }} 格式的表达式提取和规范化
 */

/**
 * 提取表达式字符串
 * 支持 {{ expression }} 格式，自动去掉包装
 * 
 * @param expr 表达式字符串，可能是 "{{ showContent }}" 或 "showContent"
 * @returns 去掉 {{ }} 包装后的表达式字符串
 * 
 * @example
 * ```typescript
 * extractExpression("{{ showContent }}") // => "showContent"
 * extractExpression("showContent") // => "showContent"
 * extractExpression("{{ userRole === 'admin' }}") // => "userRole === 'admin'"
 * ```
 */
export function extractExpression(expr: string): string {
  if (typeof expr !== 'string') {
    return String(expr)
  }
  
  // 如果表达式是 {{ }} 格式，去掉包装
  if (expr.startsWith('{{') && expr.endsWith('}}')) {
    return expr.slice(2, -2).trim()
  }
  
  return expr.trim()
}

/**
 * 规范化表达式字符串
 * 确保表达式格式统一，便于后续处理
 * 
 * @param expr 表达式字符串
 * @returns 规范化后的表达式字符串（去掉 {{ }} 包装）
 */
export function normalizeExpression(expr: string): string {
  return extractExpression(expr)
}

/**
 * 检查是否为表达式格式
 * 
 * @param value 要检查的值
 * @returns 如果是 {{ }} 格式返回 true
 */
export function isExpressionFormat(value: any): boolean {
  return typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')
}

/**
 * 批量提取表达式
 * 从对象或数组中提取所有表达式字符串
 * 
 * @param value 要处理的值（对象、数组或字符串）
 * @param extractor 提取函数，默认使用 extractExpression
 * @returns 处理后的值
 */
export function extractExpressionsRecursively(
  value: any,
  extractor: (expr: string) => string = extractExpression
): any {
  // 字符串：检查是否为表达式
  if (typeof value === 'string') {
    return extractor(value)
  }
  
  // 数组：递归处理每个元素
  if (Array.isArray(value)) {
    return value.map(item => extractExpressionsRecursively(item, extractor))
  }
  
  // 对象：递归处理每个属性值
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = extractExpressionsRecursively(val, extractor)
    }
    return result
  }
  
  // 其他类型：直接返回
  return value
}
