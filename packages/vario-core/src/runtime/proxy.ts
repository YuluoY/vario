/**
 * Proxy 沙箱实现
 * 
 * 功能：
 * - 防止覆盖系统 API（$ 和 _ 前缀保护）
 * - 拦截属性设置操作
 */

import type { RuntimeContext } from '@variojs/types'

/**
 * 创建受保护的 Proxy 上下文
 * 禁止设置以 $ 或 _ 开头的属性
 * 
 * @template T 上下文类型，必须是 RuntimeContext 的子类型
 * @param ctx 运行时上下文对象
 * @returns 受保护的 Proxy 包装的上下文
 */
export function createProxy<T extends RuntimeContext>(ctx: T): T {
  // 允许设置和删除的特殊变量（循环/事件上下文变量；vario-vue 节点关系扩展）
  // 注意：$methods 不在此列表中，不允许被整体覆盖
  const allowedSpecialVars = [
    '$event',
    '$item',
    '$index',
    '$self',
    '$parent',
    '$siblings',
    '$children'
  ]
  
  return new Proxy(ctx, {
    set(target, prop, value) {
      const propName = String(prop)
      
      // 禁止覆盖系统 API
      if (propName.startsWith('$') || propName.startsWith('_')) {
        // 允许设置特殊变量
        if (allowedSpecialVars.includes(propName)) {
          return Reflect.set(target, prop, value)
        }
        
        throw new Error(
          `Cannot override system API: ${propName}. ` +
          `Properties starting with "$" or "_" are protected.`
        )
      }
      
      return Reflect.set(target, prop, value)
    },
    
    get(target, prop) {
      return Reflect.get(target, prop)
    },
    
    has(target, prop) {
      return Reflect.has(target, prop)
    },
    
    deleteProperty(target, prop) {
      const propName = String(prop)
      
      // 禁止删除系统 API
      if (propName.startsWith('$') || propName.startsWith('_')) {
        // 允许删除特殊变量
        if (allowedSpecialVars.includes(propName)) {
          return Reflect.deleteProperty(target, prop)
        }
        throw new Error(`Cannot delete system API: ${propName}`)
      }
      
      return Reflect.deleteProperty(target, prop)
    }
  })
}
