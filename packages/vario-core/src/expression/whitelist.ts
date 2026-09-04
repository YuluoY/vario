/**
 * AST 白名单验证器
 * 
 * 功能：
 * - 深度遍历 AST，检查每个节点
 * - 只允许安全的语法节点
 * - 禁止危险的语法（赋值、函数、this 等）
 * - 检查函数调用中的函数名是否在白名单中
 */

import type * as ESTree from '@babel/types'
import { ExpressionError, ErrorCodes } from '../errors.js'
import {
  DANGEROUS_FUNCTIONS,
  isExactWhitelistedFunction,
  isWhitelistedGlobalStaticCall,
  SAFE_ARRAY_METHODS,
  ALLOWED_CAPABILITY_ROOTS,
} from './policy.js'

/** 数组的原地变更方法：仅链式调用（slice().reverse()）放行 */
const CHAINED_MUTATOR_METHODS = new Set(['reverse', 'sort'])

/**
 * 允许的 AST 节点类型
 * 
 * 注意：@babel/types 可能使用更具体的字面量类型（如 NumericLiteral, StringLiteral）
 * 这些都应该被允许，因为它们都是 Literal 的子类型
 */
const ALLOWED_NODE_TYPES = new Set([
  'MemberExpression',      // 成员访问：user.name
  'OptionalMemberExpression', // 可选链：user?.name
  'ArrayExpression',       // 数组字面量：[1, 2, 3]
  'ObjectExpression',      // 对象字面量：{ a: 1 }
  'ObjectProperty',        // 对象属性：{ a: 1 } 中的 a: 1
  'Literal',               // 字面量：'string', 123, true
  'NumericLiteral',        // 数字字面量：123（@babel/types 的具体类型）
  'StringLiteral',         // 字符串字面量：'string'
  'BooleanLiteral',        // 布尔字面量：true, false
  'NullLiteral',           // null 字面量
  'Identifier',            // 标识符：user, name
  'BinaryExpression',     // 二元运算：a + b
  'LogicalExpression',     // 逻辑运算：a && b
  'UnaryExpression',       // 一元运算：!a, -b
  'ConditionalExpression', // 三元表达式：a ? b : c
  'CallExpression',        // 函数调用：Math.max()
  'TemplateLiteral',      // 模板字符串：`${name}`
  'TemplateElement',      // 模板字符串分段
  'SequenceExpression',   // 序列表达式：(a, b)
  'NullishCoalescingExpression', // 空值合并：a ?? b
])

/**
 * 禁止的 AST 节点类型
 */
const FORBIDDEN_NODE_TYPES = new Set([
  'AssignmentExpression',      // 赋值：a = b
  'UpdateExpression',          // 自增/自减：a++, --b
  'FunctionExpression',         // 函数表达式：function() {}
  'ArrowFunctionExpression',    // 箭头函数：() => {}
  'ThisExpression',            // this
  'NewExpression',             // new 运算符
  'YieldExpression',          // yield
  'AwaitExpression',           // await
  'ImportExpression',          // import()
  'MetaProperty',              // import.meta
  'SpreadElement',             // 展开运算符：...array（在函数调用中不安全）
])

/**
 * 默认最大嵌套深度（防止 DoS 攻击）
 */
const DEFAULT_MAX_NESTING_DEPTH = 50

/**
 * 验证 AST 是否通过白名单检查
 * 
 * @param ast AST 节点
 * @param options 验证选项
 * @param options.allowGlobals 是否允许全局函数调用（跳过白名单检查）
 * @param options.maxNestingDepth 最大嵌套深度（默认 50）
 * @throws ExpressionError 如果发现禁止的节点
 */
export function validateAST(ast: ESTree.Node, options?: { allowGlobals?: boolean; maxNestingDepth?: number }): void {
  const allowGlobals = options?.allowGlobals === true
  const maxNestingDepth = options?.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH
  const errors: string[] = []
  
  function getFunctionName(callee: ESTree.Node): string | null {
    if (callee.type === 'Identifier') {
      return callee.name
    }
    if (callee.type === 'MemberExpression') {
      const member = callee as ESTree.MemberExpression
      if (member.object.type === 'Identifier' && member.property.type === 'Identifier') {
        return `${member.object.name}.${member.property.name}`
      }
    }
    return null
  }

  function traverse(node: ESTree.Node, path: string = 'root', depth: number = 0): void {
    // 检查嵌套深度（防止 DoS 攻击）
    if (depth > maxNestingDepth) {
      errors.push(`Maximum nesting depth (${maxNestingDepth}) exceeded at ${path}`)
      return
    }
    
    // 检查节点类型
    if (FORBIDDEN_NODE_TYPES.has(node.type)) {
      errors.push(`Forbidden node type "${node.type}" at ${path}`)
      return
    }
    
    // 检查函数调用中的函数名
    if (node.type === 'CallExpression') {
      const call = node as ESTree.CallExpression
      const funcName = getFunctionName(call.callee)
      if (funcName) {
        // 检查是否为危险函数（eval, Function, etc.）- 即使 allowGlobals 也禁止
        const dangerousFunctions = DANGEROUS_FUNCTIONS
        if (dangerousFunctions.has(funcName) || funcName.startsWith('eval') || funcName.startsWith('Function')) {
          errors.push(`Dangerous function "${funcName}" is not allowed at ${path}`)
          return
        }
        
        if (!allowGlobals) {
          let allowed = isExactWhitelistedFunction(funcName) || isWhitelistedGlobalStaticCall(funcName)
          if (!allowed && call.callee.type === 'MemberExpression' && !call.callee.computed) {
            const member = call.callee as ESTree.MemberExpression
            if (member.property.type === 'Identifier') {
              const prop = member.property.name
              if (SAFE_ARRAY_METHODS.has(prop)) allowed = true
              if (member.object.type === 'Identifier' && ALLOWED_CAPABILITY_ROOTS.has(member.object.name)) {
                allowed = true
              }
              // reverse/sort 仅链式调用（callee 对象为 CallExpression 结果）放行
              if (CHAINED_MUTATOR_METHODS.has(prop) && member.object.type === 'CallExpression') {
                allowed = true
              }
            }
          }
          if (!allowed) {
            if (
              call.callee.type === 'MemberExpression' &&
              !call.callee.computed &&
              call.callee.property.type === 'Identifier' &&
              CHAINED_MUTATOR_METHODS.has(call.callee.property.name)
            ) {
              errors.push(`Function "${funcName}" mutates state; use slice().reverse() at ${path}`)
            } else {
              errors.push(`Function "${funcName}" is not in whitelist at ${path}`)
            }
            return
          }
        }
      }
    }
    
    if (!ALLOWED_NODE_TYPES.has(node.type) && node.type !== 'Program') {
      // 未知节点类型，保守策略：禁止
      errors.push(`Unknown node type "${node.type}" at ${path}`)
      return
    }
    
    // 递归遍历子节点
    for (const key in node) {
      const value = (node as unknown as Record<string, unknown>)[key]
      
      if (value == null) continue
      
      // 处理数组
      if (Array.isArray(value)) {
        value.forEach((child, index) => {
          if (child && typeof child === 'object' && 'type' in child) {
            traverse(child as ESTree.Node, `${path}[${index}]`, depth + 1)
          }
        })
      }
      // 处理对象节点
      else if (value && typeof value === 'object' && 'type' in value) {
        traverse(value as ESTree.Node, `${path}.${key}`, depth + 1)
      }
    }
  }
  
  traverse(ast, 'root', 0)
  
  if (errors.length > 0) {
    throw new ExpressionError(
      JSON.stringify(ast),
      `AST validation failed:\n${errors.join('\n')}`,
      ErrorCodes.EXPRESSION_VALIDATION_ERROR,
      {
        metadata: {
          errors,
          nodeType: ast.type
        }
      }
    )
  }
}
