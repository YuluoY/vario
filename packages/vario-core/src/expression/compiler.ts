/**
 * 表达式编译器
 * 
 * 功能：
 * - 将简单表达式编译为直接访问函数
 * - 提升简单表达式的执行性能
 * - 复杂表达式回退到解释执行
 */

import type * as ESTree from '@babel/types'
import type { RuntimeContext } from '../types.js'

/**
 * 编译后的表达式函数类型
 */
export type CompiledExpression = (ctx: RuntimeContext) => unknown

/**
 * 编译缓存（全局，表达式字符串 → 编译函数）
 */
const compiledCache = new Map<string, CompiledExpression | null>()

/**
 * 提取静态路径（从 MemberExpression）
 * 
 * 例如：user.name → "user.name"
 * 例如：items.0.text → "items.0.text"
 */
function extractStaticPath(node: ESTree.Node): string | null {
  if (node.type === 'Identifier') {
    return node.name
  }
  
  if (node.type === 'MemberExpression') {
    const object = extractStaticPath(node.object)
    if (!object) return null
    
    if (node.computed) {
      // 计算属性：obj[key]，需要检查 key 是否为字面量
      if (node.property.type === 'NumericLiteral') {
        const prop = (node.property as ESTree.NumericLiteral).value
        return `${object}.${String(prop)}`
      }
      if (node.property.type === 'StringLiteral') {
        const prop = (node.property as ESTree.StringLiteral).value
        return `${object}.${String(prop)}`
      }
      // 处理其他字面量类型（已由上面的具体类型处理，这里不需要）
      return null
    } else {
      // 静态属性：obj.prop
      if (node.property.type === 'Identifier') {
        return `${object}.${node.property.name}`
      }
      return null
    }
  }
  
  return null
}

/**
 * 编译简单表达式为直接访问函数
 * 
 * @param ast AST 节点
 * @returns 编译后的函数，如果无法编译则返回 null
 */
export function compileSimpleExpression(ast: ESTree.Node): CompiledExpression | null {
  // 字面量：{{ 42 }} → () => 42
  if (ast.type === 'NumericLiteral') {
    const value = (ast as ESTree.NumericLiteral).value
    return () => value
  }
  if (ast.type === 'StringLiteral') {
    const value = (ast as ESTree.StringLiteral).value
    return () => value
  }
  if (ast.type === 'BooleanLiteral') {
    const value = (ast as ESTree.BooleanLiteral).value
    return () => value
  }
  if (ast.type === 'NullLiteral') {
    return () => null
  }
  // 注意：Literal 类型已被更具体的类型（NumericLiteral, StringLiteral等）替代
  // 如果遇到其他字面量类型，回退到解释执行
  
  // 标识符：{{ user }} → (ctx) => ctx._get('user')
  // 注意：全局对象名称（window, document等）不应该被编译，应该回退到解释执行以进行安全检查
  if (ast.type === 'Identifier') {
    const name = ast.name
    // 全局对象名称不应该被编译（需要安全检查）
    const globalObjectNames = ['window', 'document', 'global', 'globalThis', 'self']
    if (globalObjectNames.includes(name)) {
      return null  // 回退到解释执行
    }
    return (ctx: RuntimeContext) => ctx._get(name)
  }
  
  // 静态成员访问：{{ user.name }} → (ctx) => ctx._get('user.name')
  // 注意：如果路径以全局对象名称开头，不应该被编译
  const path = extractStaticPath(ast)
  if (path) {
    // 检查路径是否以全局对象名称开头
    const globalObjectNames = ['window', 'document', 'global', 'globalThis', 'self']
    const firstSegment = path.split('.')[0]
    if (globalObjectNames.includes(firstSegment)) {
      return null  // 回退到解释执行以进行安全检查
    }
    return (ctx: RuntimeContext) => ctx._get(path)
  }
  
  return null  // 复杂表达式，无法编译
}

/**
 * 获取或编译表达式
 * 
 * @param expr 表达式字符串
 * @param ast AST 节点（已解析）
 * @returns 编译后的函数，如果无法编译则返回 null
 */
export function getCompiledExpression(
  expr: string,
  ast: ESTree.Node
): CompiledExpression | null {
  // 检查缓存
  if (compiledCache.has(expr)) {
    return compiledCache.get(expr) || null
  }
  
  // 尝试编译
  const compiled = compileSimpleExpression(ast)
  compiledCache.set(expr, compiled)
  
  return compiled
}

/**
 * 清除编译缓存
 */
export function clearCompiledCache(): void {
  compiledCache.clear()
}
