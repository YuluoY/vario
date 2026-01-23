/**
 * 依赖提取算法
 * 
 * 功能：
 * - 从 AST 中提取状态依赖
 * - 支持通配符依赖（items.*）
 * - 保守策略：标记整个对象
 */

import type * as ESTree from '@babel/types'

/**
 * 从 AST 中提取依赖的状态路径
 * 
 * @param ast AST 节点
 * @returns 依赖路径数组（支持通配符）
 */
export function extractDependencies(ast: ESTree.Node): string[] {
  const dependencies = new Set<string>()
  
  function traverse(node: ESTree.Node, path: string = ''): void {
    switch (node.type) {
      case 'Identifier': {
        const id = node as ESTree.Identifier
        // 标识符可能是状态依赖（排除全局函数）
        if (!isGlobalFunction(id.name)) {
          dependencies.add(id.name)
        }
        break
      }
      
      case 'MemberExpression': {
        const member = node as ESTree.MemberExpression
        const object = member.object
        
        if (object.type === 'Identifier') {
          const basePath = object.name
          
          if (member.computed) {
            // 计算属性：items[0] -> 保守策略：标记 items.*
            dependencies.add(`${basePath}.*`)
            traverse(member.property, path)
          } else {
            // 静态属性：user.name
            const prop = (member.property as ESTree.Identifier).name
            dependencies.add(`${basePath}.${prop}`)
            // 同时添加通配符依赖（保守策略）
            dependencies.add(`${basePath}.*`)
          }
        } else {
          // 嵌套成员访问：user.profile.name
          traverse(object, path)
        }
        
        break
      }
      
      case 'OptionalMemberExpression': {
        const member = node as ESTree.OptionalMemberExpression
        const object = member.object
        
        if (object.type === 'Identifier') {
          const basePath = object.name
          
          if (member.computed) {
            dependencies.add(`${basePath}.*`)
            traverse(member.property, path)
          } else {
            const prop = (member.property as ESTree.Identifier).name
            dependencies.add(`${basePath}.${prop}`)
            dependencies.add(`${basePath}.*`)
          }
        } else {
          traverse(object, path)
        }
        
        break
      }
      
      default: {
        // 递归遍历所有子节点
        for (const key in node) {
          const value = (node as unknown as Record<string, unknown>)[key]
          
          if (value == null) continue
          
          if (Array.isArray(value)) {
            value.forEach(child => {
              if (child && typeof child === 'object' && 'type' in child) {
                traverse(child as ESTree.Node, path)
              }
            })
          } else if (value && typeof value === 'object' && 'type' in value) {
            traverse(value as ESTree.Node, path)
          }
        }
      }
    }
  }
  
  traverse(ast)
  return Array.from(dependencies)
}

/**
 * 检查是否为全局函数（不应作为依赖）
 */
function isGlobalFunction(name: string): boolean {
  const globals = new Set([
    'String', 'Number', 'Boolean', 'BigInt', 'Symbol',
    'Array', 'Object', 'Math', 'Date',
    'console', 'JSON', 'parseInt', 'parseFloat',
    'isNaN', 'isFinite',
  ])
  return globals.has(name)
}
