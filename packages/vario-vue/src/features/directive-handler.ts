/**
 * 指令处理模块
 * 
 * 负责将 Schema 中的指令配置转换为 Vue 指令
 * 支持类似 Vue withDirectives 的数组简写格式
 */

import type { DirectiveConfig, DirectiveObject, DirectiveArray } from '@variojs/schema'
import type { Directive, DirectiveArguments } from 'vue'
import type { RuntimeContext } from '@variojs/core'

/**
 * 指令处理器
 */
export class DirectiveHandler {
  constructor(
    private evaluateExpr: (expr: string, ctx: RuntimeContext) => any
  ) {}

  /**
   * 规范化指令配置为标准的 DirectiveObject 数组
   */
  private normalizeDirectives(config: DirectiveConfig): DirectiveObject[] {
    // 1. 已经是数组
    if (Array.isArray(config)) {
      // 检查是否是单个数组简写格式 [name, value, arg, modifiers]
      if (
        config.length >= 1 &&
        typeof config[0] === 'string' &&
        !Array.isArray(config[0])
      ) {
        // 单个数组简写
        return [this.normalizeDirectiveArray(config as unknown as DirectiveArray)]
      }
      
      // 多个指令的数组
      return config.map(item => {
        if (Array.isArray(item)) {
          return this.normalizeDirectiveArray(item as unknown as DirectiveArray)
        }
        return item as DirectiveObject
      })
    }
    
    // 2. 单个完整对象（包含 name 字段）
    if ('name' in config) {
      return [config as DirectiveObject]
    }
    
    // 3. 对象映射格式 { focus: true, custom: 'value' }
    return Object.entries(config).map(([name, value]) => ({
      name,
      value
    }))
  }

  /**
   * 将数组简写转换为完整对象
   * [name, value?, arg?, modifiers?] -> DirectiveObject
   */
  private normalizeDirectiveArray(arr: DirectiveArray): DirectiveObject {
    const [name, value, arg, modifiers] = arr
    
    return {
      name,
      ...(value !== undefined && { value }),
      ...(arg !== undefined && { arg }),
      ...(modifiers !== undefined && { modifiers })
    }
  }

  /**
   * 求值指令的值（处理表达式）
   */
  private evaluateDirectiveValue(value: unknown, ctx: RuntimeContext): any {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const expr = value.slice(2, -2).trim()
      try {
        return this.evaluateExpr(expr, ctx)
      } catch (error) {
        console.warn(`Failed to evaluate directive value expression: ${value}`, error)
        return value
      }
    }
    return value
  }

  /**
   * 将规范化的指令对象转换为 Vue DirectiveArguments 格式
   * 用于 withDirectives(vnode, directives)
   */
  toVueDirectiveArguments(
    config: DirectiveConfig | undefined,
    ctx: RuntimeContext,
    directiveMap: Map<string, Directive>
  ): DirectiveArguments | null {
    if (!config) {
      return null
    }

    const normalized = this.normalizeDirectives(config)
    
    const directives: DirectiveArguments = normalized.map(directive => {
      const { name, value, arg, modifiers } = directive
      
      // 获取指令实现
      const directiveImpl = directiveMap.get(name)
      if (!directiveImpl) {
        console.warn(`Directive '${name}' not found in directive map`)
        // 返回一个空的指令对象，避免中断
        return [{} as Directive, undefined, arg, modifiers] as any
      }
      
      // 求值指令的值
      const evaluatedValue = this.evaluateDirectiveValue(value, ctx)
      
      // 返回 Vue DirectiveArguments 格式
      // [Directive, value, argument, modifiers]
      if (modifiers !== undefined) {
        return [directiveImpl, evaluatedValue, arg, modifiers as Partial<Record<string, boolean>>]
      } else if (arg !== undefined) {
        return [directiveImpl, evaluatedValue, arg]
      } else {
        return [directiveImpl, evaluatedValue]
      }
    })
    
    return directives.length > 0 ? directives : null
  }

  /**
   * 注册内置指令到指令映射表
   */
  static registerBuiltInDirectives(directiveMap: Map<string, Directive>): void {
    // 注册 v-focus 指令
    directiveMap.set('focus', {
      mounted(el, binding) {
        if (binding.value !== false) {
          el.focus()
        }
      }
    })
    
    // 可以添加更多内置指令
    // directiveMap.set('custom', { ... })
  }
}
