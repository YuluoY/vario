/**
 * 表达式求值器
 * 
 * 功能：
 * - 安全求值 AST
 * - 支持白名单函数调用
 * - 执行步数/时间限制
 */

import type * as ESTree from '@babel/types'
import type { RuntimeContext, ExpressionOptions } from '../types.js'
import { ExpressionError, ErrorCodes } from '../errors.js'
import { isSafePropertyAccess } from '../runtime/sandbox.js'

/**
 * 白名单全局函数
 */
const WHITELISTED_GLOBALS = new Set([
  'String', 'Number', 'Boolean', 'BigInt', 'Symbol',
  'Array', 'Object', 'Math', 'Date',
])

/**
 * 白名单函数（带命名空间）
 */
const WHITELISTED_FUNCTIONS = new Set([
  'Array.isArray',
  'Object.is',
  'Number.isFinite',
  'Number.isInteger',
  'Number.isNaN',
  'Number.isSafeInteger',
  'Math.abs',
  'Math.round',
  'Math.floor',
  'Math.ceil',
  'Math.random',
  'Math.max',
  'Math.min',
  'Date.now',
])

/**
 * 安全的数组方法（只读或返回新数组，不修改原状态）
 */
const SAFE_ARRAY_METHODS = new Set([
  // 返回新数组
  'slice',
  'concat',
  'filter',
  'map',
  'flat',
  'flatMap',
  'toReversed',   // ES2023 不修改原数组的 reverse
  'toSorted',     // ES2023 不修改原数组的 sort
  'toSpliced',    // ES2023 不修改原数组的 splice
  'with',         // ES2023 不修改原数组的索引赋值
  // 只读方法
  'indexOf',
  'lastIndexOf',
  'includes',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'every',
  'some',
  'at',
  // 返回字符串
  'join',
  'toString',
  'toLocaleString',
  // 在链式调用中安全使用（如 slice().reverse()）
  'reverse',
  'sort',
])

/**
 * 危险属性名称集合（用于阻止原型链污染攻击）
 * - constructor: 可用于访问 Function 构造函数
 * - prototype: 可用于修改原型链
 * - __proto__: 可用于修改对象原型
 */
const DANGEROUS_PROPERTIES = new Set([
  'constructor',
  'prototype',
  '__proto__',
])

/**
 * 检查属性名是否为危险属性
 */
function isDangerousProperty(propName: string | number): boolean {
  return typeof propName === 'string' && DANGEROUS_PROPERTIES.has(propName)
}

/**
 * 运行时辅助函数
 */
  const RUNTIME_HELPERS: Record<string, (...args: unknown[]) => unknown> = {
  '$truncate': (str: unknown, length: unknown): unknown => {
    if (typeof str !== 'string') return str
    const len = typeof length === 'number' ? length : 0
    return str.length > len ? str.slice(0, len) + '...' : str
  },
  '$format': (date: unknown, _format?: unknown): unknown => {
    const d = typeof date === 'number' ? new Date(date) : (date as Date)
    // 简单格式化，可根据需要扩展
    // format 参数暂未实现，保留接口以便未来扩展
    return d.toISOString()
  },
}

/**
 * 安全求值 AST
 * 
 * @param ast AST 节点
 * @param ctx 运行时上下文
 * @param options 求值选项
 * @returns 求值结果（类型无法静态推导）
 * 
 * 注意：表达式求值结果类型无法在编译时确定，返回 unknown
 */
export function evaluateExpression(
  ast: ESTree.Node,
  ctx: RuntimeContext,
  options: ExpressionOptions = {}
): unknown {
  const mergedOptions = {
    ...ctx.$exprOptions,
    ...options
  }
  const allowGlobals = mergedOptions.allowGlobals === true
  const maxSteps = mergedOptions.maxSteps ?? 1000
  const timeout = mergedOptions.timeout ?? 100
  let stepCount = 0
  const startTime = Date.now()
  
  function getGlobalValueByName(name: string): unknown {
    if (!allowGlobals) return undefined
    // 只有在 allowGlobals 为 true 时才返回全局对象
    if (name === 'globalThis') return globalThis
    if (name === 'window' && typeof window !== 'undefined') return window
    if (name === 'document' && typeof document !== 'undefined') return document
    if (name === 'global' && typeof global !== 'undefined') return global
    if (name === 'self' && typeof self !== 'undefined') return self
    // 只有在 allowGlobals 为 true 时才访问 globalThis 的属性
    return (globalThis as Record<string, unknown>)[name]
  }
  
  function isGlobalObjectName(name: string): boolean {
    return ['window', 'document', 'global', 'globalThis', 'self'].includes(name)
  }

  function checkLimits(): void {
    stepCount++
    if (stepCount > maxSteps) {
      throw new ExpressionError(
        JSON.stringify(ast),
        `Expression evaluation exceeded max steps (${maxSteps})`,
        ErrorCodes.EXPRESSION_MAX_STEPS_EXCEEDED,
        {
          metadata: {
            maxSteps,
            currentSteps: stepCount
          }
        }
      )
    }
    
    if (Date.now() - startTime > timeout) {
      throw new ExpressionError(
        JSON.stringify(ast),
        `Expression evaluation exceeded timeout (${timeout}ms)`,
        ErrorCodes.EXPRESSION_TIMEOUT,
        {
          metadata: {
            timeout,
            elapsedTime: Date.now() - startTime
          }
        }
      )
    }
  }
  
  function evaluate(node: ESTree.Node): unknown {
    checkLimits()
    
    // 使用类型断言处理 node.type，因为 @babel/types 的类型定义可能不完整
    // TypeScript 的严格类型检查可能不识别某些节点类型，使用类型断言绕过
    const nodeType = (node as { type: string }).type as string
    switch (nodeType) {
      case 'NumericLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'BigIntLiteral':
      case 'DecimalLiteral':
      case 'RegExpLiteral': {
        // 这些字面量类型都有 value 属性
        return (node as any).value;
      }
      case 'NullLiteral': {
        return null;
      }
      
      case 'Literal': {
        const literal = node as ESTree.Literal
        // 处理不同类型的字面量
        // @babel/types 的 Literal 类型包含多种字面量类型
        // 使用类型守卫安全访问 value 属性
        if ('value' in literal && literal.value !== undefined) {
          return literal.value
        }
        // NullLiteral 或 BigIntLiteral 可能没有 value 属性，或 value 为 null
        // 检查类型名称
        const literalType = (literal as { type: string }).type
        if (literalType === 'NullLiteral') {
          return null
        }
        // 其他情况：尝试访问 value，如果不存在则返回 undefined
        return (literal as { value?: unknown }).value ?? undefined
      }
      
      case 'Identifier': {
        const name = (node as ESTree.Identifier).name
        
        // 检查是否为全局对象名称（无论是否存在，都应该被禁止，除非 allowGlobals）
        // 必须在检查 ctx 之前，防止 ctx 中有同名属性绕过检查
        if (isGlobalObjectName(name) && !allowGlobals) {
          throw new ExpressionError(
            name,
            `Access to global "${name}" is not allowed in expressions`,
            ErrorCodes.EXPRESSION_UNSAFE_ACCESS
          )
        }
        
        // 从上下文获取值（优先从 ctx，但全局对象名称已经被上面的检查拦截）
        // 注意：即使 ctx 中有 window/document 等属性，也不应该访问（安全考虑）
        if (name in ctx && !isGlobalObjectName(name)) {
          return ctx[name]
        }

        // 允许直接访问全局对象（由 allowGlobals 控制）
        if (allowGlobals) {
          const globalValue = getGlobalValueByName(name)
          if (globalValue !== undefined) {
            return globalValue
          }
        }
        
        // 如果是白名单全局函数，允许访问（但仅用于函数调用，这里返回 undefined）
        if (WHITELISTED_GLOBALS.has(name)) {
          return (globalThis as Record<string, unknown>)[name]
        }
        
        // 未定义的标识符返回 undefined（而不是抛出错误，允许可选链等场景）
        return undefined
      }
      
      case 'MemberExpression': {
        const member = node as ESTree.MemberExpression
        const object = evaluate(member.object)
        
        // null/undefined 检查
        if (object == null) {
          return undefined
        }
        
        // 禁止访问全局对象（检查对象是否为全局对象）
        if (!allowGlobals) {
          // 检查对象是否为全局对象
          const isGlobal = object === globalThis || 
                          (typeof window !== 'undefined' && object === window) ||
                          (typeof global !== 'undefined' && object === global) ||
                          (typeof self !== 'undefined' && object === self)
          if (isGlobal) {
            throw new ExpressionError(
              JSON.stringify(node),
              'Access to global object is not allowed in expressions',
              ErrorCodes.EXPRESSION_UNSAFE_ACCESS
            )
          }
        }
        
        // 获取属性名
        let propName: string | number
        if (member.computed) {
          // 计算属性：obj[key]
          propName = evaluate(member.property) as string | number
        } else {
          // 静态属性：obj.prop
          propName = (member.property as ESTree.Identifier).name
        }
        
        // 禁止访问危险属性（constructor, prototype, __proto__）
        if (!allowGlobals && isDangerousProperty(propName)) {
          throw new ExpressionError(
            String(propName),
            `Access to "${propName}" is not allowed in expressions`,
            ErrorCodes.EXPRESSION_UNSAFE_ACCESS
          )
        }
        
        return (object as Record<string | number, unknown>)[propName]
      }
      
      case 'OptionalMemberExpression': {
        const member = node as ESTree.OptionalMemberExpression
        const object = evaluate(member.object)
        
        // null/undefined 检查（可选链特性）
        if (object == null) {
          return undefined
        }
        
        // 禁止访问全局对象（检查对象是否为全局对象）
        if (!allowGlobals) {
          // 检查对象是否为全局对象
          const isGlobal = object === globalThis || 
                          (typeof window !== 'undefined' && object === window) ||
                          (typeof global !== 'undefined' && object === global) ||
                          (typeof self !== 'undefined' && object === self)
          if (isGlobal) {
            throw new ExpressionError(
              JSON.stringify(node),
              'Access to global object is not allowed in expressions',
              ErrorCodes.EXPRESSION_UNSAFE_ACCESS
            )
          }
        }
        
        // 获取属性名
        let propName: string | number
        if (member.computed) {
          // 计算属性：obj?.[key]
          propName = evaluate(member.property) as string | number
        } else {
          // 静态属性：obj?.prop
          propName = (member.property as ESTree.Identifier).name
        }
        
        // 禁止访问危险属性（constructor, prototype, __proto__）
        if (!allowGlobals && isDangerousProperty(propName)) {
          throw new ExpressionError(
            String(propName),
            `Access to "${propName}" is not allowed in expressions`,
            ErrorCodes.EXPRESSION_UNSAFE_ACCESS
          )
        }
        
        return (object as Record<string | number, unknown>)?.[propName]
      }
      
      case 'BinaryExpression': {
        const binary = node as ESTree.BinaryExpression
        const left = evaluate(binary.left)
        const right = evaluate(binary.right)
        const operator = binary.operator
        
        // 类型安全的二元运算
        switch (operator) {
          case '+': return (left as number) + (right as number)
          case '-': return (left as number) - (right as number)
          case '*': return (left as number) * (right as number)
          case '/': return (left as number) / (right as number)
          case '%': return (left as number) % (right as number)
          case '**': return (left as number) ** (right as number)
          case '==': return left == right
          case '!=': return left != right
          case '===': return left === right
          case '!==': return left !== right
          case '<': return (left as number) < (right as number)
          case '<=': return (left as number) <= (right as number)
          case '>': return (left as number) > (right as number)
          case '>=': return (left as number) >= (right as number)
          case '<<': return (left as number) << (right as number)
          case '>>': return (left as number) >> (right as number)
          case '>>>': return (left as number) >>> (right as number)
          case '&': return (left as number) & (right as number)
          case '|': return (left as number) | (right as number)
          case '^': return (left as number) ^ (right as number)
          case 'in': return (left as string | number) in (right as object)
          case 'instanceof': {
            // instanceof 需要检查 right 是否为构造函数
            if (typeof right !== 'function' && typeof right !== 'object') {
              throw new ExpressionError(
                JSON.stringify(node),
                'Right-hand side of instanceof must be a constructor',
                ErrorCodes.EXPRESSION_EVALUATION_ERROR
              )
            }
            return left instanceof (right as new (...args: unknown[]) => unknown)
          }
          default:
            throw new ExpressionError(
              JSON.stringify(node),
              `Unsupported binary operator: ${operator}`,
              ErrorCodes.EXPRESSION_EVALUATION_ERROR
            )
        }
      }
      
      case 'LogicalExpression': {
        const logical = node as ESTree.LogicalExpression
        const left = evaluate(logical.left)
        const operator = logical.operator
        
        if (operator === '&&') {
          return left && evaluate(logical.right)
        } else if (operator === '||') {
          return left || evaluate(logical.right)
        } else if (operator === '??') {
          return left ?? evaluate(logical.right)
        }
        
        throw new ExpressionError(
          JSON.stringify(node),
          `Unsupported logical operator: ${operator}`,
          ErrorCodes.EXPRESSION_EVALUATION_ERROR
        )
      }
      
      case 'UnaryExpression': {
        const unary = node as ESTree.UnaryExpression
        const argument = evaluate(unary.argument)
        const operator = unary.operator
        
        switch (operator) {
          case '+': return +(argument as number)
          case '-': return -(argument as number)
          case '!': return !argument
          case '~': return ~(argument as number)
          case 'typeof': return typeof argument
          case 'void': return void argument
          case 'delete': throw new ExpressionError(
            JSON.stringify(node),
            'delete operator is not allowed',
            ErrorCodes.EXPRESSION_EVALUATION_ERROR
          )
          default:
            throw new ExpressionError(
              JSON.stringify(node),
              `Unsupported unary operator: ${operator}`,
              ErrorCodes.EXPRESSION_EVALUATION_ERROR
            )
        }
      }
      
      case 'ConditionalExpression': {
        const conditional = node as ESTree.ConditionalExpression
        const test = evaluate(conditional.test)
        return test ? evaluate(conditional.consequent) : evaluate(conditional.alternate)
      }
      
      // NullishCoalescingExpression 在 @babel/types 中可能不存在
      // 使用 LogicalExpression 处理 ?? 运算符（operator === '??'）
      // 如果类型系统支持，可以添加此 case
      
      case 'CallExpression': {
        const call = node as ESTree.CallExpression
        const callee = call.callee
        
        // 获取函数名和对象
        let funcName: string
        let funcObj: unknown
        let callContext: unknown = null // 函数调用的上下文（this）
        
        if (callee.type === 'Identifier') {
          // 直接函数调用：String(), Math.max()
          funcName = callee.name
          
          // 检查是否为全局对象（禁止访问）
          if (!isSafePropertyAccess(funcName, ctx, { allowGlobals })) {
            throw new ExpressionError(
              funcName,
              `Access to global "${funcName}" is not allowed in expressions`,
              'UNSAFE_ACCESS'
            )
          }
          
          // 从上下文或全局获取函数
          funcObj = ctx[funcName] ?? (globalThis as Record<string, unknown>)[funcName]
          callContext = null // 全局函数调用，this 为 null
        } else if (callee.type === 'MemberExpression') {
          // 成员函数调用：Math.max(), Array.isArray(), array.slice()
          const member = callee as ESTree.MemberExpression
          const obj = evaluate(member.object)
          
          // null/undefined 检查
          if (obj == null) {
            throw new ExpressionError(
              JSON.stringify(node),
              `Cannot call method on ${obj === null ? 'null' : 'undefined'}`,
              ErrorCodes.EXPRESSION_EVALUATION_ERROR
            )
          }
          
          // 检查对象是否为全局对象（禁止访问）
          if (!allowGlobals) {
            // 检查对象是否为全局对象
            const isGlobal = obj === globalThis || 
                            (typeof window !== 'undefined' && obj === window) ||
                            (typeof global !== 'undefined' && obj === global) ||
                            (typeof self !== 'undefined' && obj === self)
            if (isGlobal) {
              throw new ExpressionError(
                JSON.stringify(node),
                'Access to global object is not allowed in expressions',
                ErrorCodes.EXPRESSION_UNSAFE_ACCESS
              )
            }
          }
          
          // 检查是否是数组实例方法调用（安全的只读方法）
          if (Array.isArray(obj) && !member.computed && member.property.type === 'Identifier') {
            const methodName = (member.property as ESTree.Identifier).name
            if (SAFE_ARRAY_METHODS.has(methodName)) {
              // 这是安全的数组方法，直接使用
              funcObj = (obj as any)[methodName]
              funcName = `Array.${methodName}` // 用于标识和错误信息
              callContext = obj // 数组方法调用，this 为数组本身
            } else {
              // 不是安全的数组方法，需要检查白名单
              const objName = member.object.type === 'Identifier' 
                ? (member.object as ESTree.Identifier).name 
                : String(obj)
              funcName = `${objName}.${methodName}`
              funcObj = (obj as unknown as Record<string, unknown>)?.[methodName]
              callContext = obj
            }
          } else {
            // 非数组对象，正常处理
            // 获取对象标识符名称（如果是 Identifier）
            let objName = '';
            if (member.object.type === 'Identifier') {
              objName = (member.object as ESTree.Identifier).name;
            } else {
              // 对于其他情况，使用字符串表示，但可能不在白名单内
              objName = String(obj);
            }
            
            if (member.computed) {
              const prop = evaluate(member.property)
              funcName = `${objName}[${String(prop)}]`
              funcObj = (obj as Record<string, unknown>)?.[prop as string]
              callContext = obj
            } else {
              const prop = (member.property as ESTree.Identifier).name
              funcName = `${objName}.${prop}`
              funcObj = (obj as Record<string, unknown>)?.[prop]
              callContext = obj
            }
          }
        } else {
          throw new ExpressionError(
            JSON.stringify(node),
            'Invalid function call: only Identifier and MemberExpression are allowed',
            ErrorCodes.EXPRESSION_EVALUATION_ERROR
          )
        }
        
        // 检查白名单
        // 如果是数组方法（funcName 以 Array. 开头且方法在安全列表中），则允许
        const isArrayMethod = funcName.startsWith('Array.') && SAFE_ARRAY_METHODS.has(funcName.split('.')[1])
        const isWhitelisted = isArrayMethod ||
                             WHITELISTED_FUNCTIONS.has(funcName) || 
                             WHITELISTED_GLOBALS.has(funcName.split('.')[0]) ||
                             RUNTIME_HELPERS[funcName] !== undefined
        
        if (!allowGlobals && !isWhitelisted) {
          throw new ExpressionError(
            funcName,
            `Function "${funcName}" is not in whitelist`,
            ErrorCodes.EXPRESSION_FUNCTION_NOT_WHITELISTED
          )
        }
        
        // 执行函数调用
        const args = call.arguments.map(arg => {
          if (arg.type === 'SpreadElement') {
            throw new ExpressionError(
              JSON.stringify(node),
              'Spread operator is not allowed',
              ErrorCodes.EXPRESSION_EVALUATION_ERROR
            )
          }
          return evaluate(arg)
        })
        
        // 调用运行时辅助函数
        if (RUNTIME_HELPERS[funcName]) {
          return RUNTIME_HELPERS[funcName](...args)
        }
        
        // 调用白名单全局函数或数组方法
        if (typeof funcObj === 'function') {
          try {
            // 如果有上下文（如数组方法），使用 apply；否则直接调用
            return callContext !== null 
              ? funcObj.apply(callContext, args)
              : funcObj(...args)
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            throw new ExpressionError(
              funcName,
              `Error calling "${funcName}": ${errorMessage}`,
              ErrorCodes.EXPRESSION_EVALUATION_ERROR
            )
          }
        }
        
        throw new ExpressionError(
          funcName,
          `"${funcName}" is not a function${funcObj === undefined ? ' (undefined)' : funcObj === null ? ' (null)' : ''}`,
          ErrorCodes.EXPRESSION_EVALUATION_ERROR
        )
      }
      
      case 'ArrayExpression': {
        const array = node as ESTree.ArrayExpression
        return array.elements.map(el => {
          if (el == null) return null
          if (el.type === 'SpreadElement') {
            throw new ExpressionError(
              JSON.stringify(node),
              'Spread operator is not allowed',
              ErrorCodes.EXPRESSION_EVALUATION_ERROR
            )
          }
          return evaluate(el)
        })
      }
      
      case 'ObjectExpression': {
        const object = node as ESTree.ObjectExpression
        const result: Record<string, any> = {}
        
        for (const prop of object.properties) {
          if (prop.type === 'ObjectMethod' || prop.type === 'SpreadElement') {
            throw new ExpressionError(
              JSON.stringify(node),
              'Object methods and spread are not allowed',
              ErrorCodes.EXPRESSION_EVALUATION_ERROR
            )
          }
          
          const key = prop.key.type === 'Identifier'
            ? prop.key.name
            : String(evaluate(prop.key))
          
          result[key] = evaluate(prop.value)
        }
        
        return result
      }
      
      case 'TemplateLiteral': {
        const template = node as ESTree.TemplateLiteral
        let result = ''
        
        for (let i = 0; i < template.quasis.length; i++) {
          result += template.quasis[i].value.cooked
          if (i < template.expressions.length) {
            result += String(evaluate(template.expressions[i]))
          }
        }
        
        return result
      }
      
      default:
        throw new ExpressionError(
          JSON.stringify(node),
          `Unsupported node type: ${node.type}`,
          ErrorCodes.EXPRESSION_EVALUATION_ERROR
        )
    }
  }
  
  return evaluate(ast)
}
