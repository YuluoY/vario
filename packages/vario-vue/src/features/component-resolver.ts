/**
 * 组件解析模块
 * 
 * 负责解析 Schema 中的组件类型，支持原生 DOM 元素和全局注册的组件
 */

import { markRaw } from 'vue'

/**
 * 原生 HTML DOM 元素列表
 * 用于快速判断是否为原生元素，避免不必要的组件解析
 */
const NATIVE_DOM_ELEMENTS = new Set([
  // 文档结构
  'html', 'head', 'body', 'div', 'span', 'p', 'section', 'article', 'aside', 'nav', 'header', 'footer', 'main',
  // 文本内容
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'code', 'em', 'strong', 'small', 'sub', 'sup',
  'mark', 'del', 'ins', 'abbr', 'dfn', 'cite', 'q', 'samp', 'kbd', 'var', 'time', 'b', 'i', 'u', 's', 'wbr',
  // 列表
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // 表格
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // 表单
  'form', 'input', 'textarea', 'select', 'option', 'optgroup', 'button', 'label', 'fieldset', 'legend',
  'datalist', 'output', 'progress', 'meter',
  // 媒体
  'img', 'picture', 'source', 'audio', 'video', 'track', 'canvas', 'svg', 'math',
  // 链接
  'a', 'area', 'link', 'base',
  // 元数据
  'meta', 'title', 'style', 'script', 'noscript',
  // 嵌入内容
  'iframe', 'embed', 'object', 'param',
  // 其他
  'br', 'hr', 'template', 'slot', 'details', 'summary', 'dialog'
])

/**
 * 判断是否为原生 DOM 元素
 */
function isNativeDOMElement(type: string): boolean {
  return NATIVE_DOM_ELEMENTS.has(type.toLowerCase())
}

/**
 * 组件解析器
 */
export class ComponentResolver {
  private componentCache = new Map<string, any>()
  private globalComponents: Record<string, any> | null = null

  constructor(globalComponents: Record<string, any> | null = null) {
    this.globalComponents = globalComponents
  }

  /**
   * 解析组件
   * 自动解析全局注册的组件（通过 app.component() 注册的所有组件）
   * 不针对任何特定的组件库，完全依赖 Vue 的全局组件注册机制
   * 
   * 使用缓存提升性能
   */
  resolveComponent(type: string): any {
    // 检查缓存
    if (this.componentCache.has(type)) {
      return this.componentCache.get(type)
    }

    let resolved: any = null

    // 如果是原生 DOM 元素，直接返回类型名（Vue 的 h 函数会将其作为 HTML 标签处理）
    if (isNativeDOMElement(type)) {
      resolved = type
    } else {
      try {
        // 从全局组件注册表中查找组件
        // 支持所有通过 app.component() 注册的全局组件（包括 Element Plus、自定义组件等）
        if (this.globalComponents) {
          const globalComponent = this.globalComponents[type]
          if (globalComponent) {
            resolved = globalComponent
          } else {
            // 组件未找到，作为 HTML 标签使用（可能是未知的原生元素或自定义标签）
            resolved = type
          }
        } else {
          resolved = type
        }
      } catch (error) {
        // 解析失败，作为 HTML 标签使用
        resolved = type
      }
    }

    // 缓存结果（包括原生元素和字符串类型，避免重复解析）
    // 对于组件对象（非字符串），使用 markRaw 标记，避免被响应式处理
    const cachedComponent = typeof resolved === 'string' ? resolved : markRaw(resolved)
    this.componentCache.set(type, cachedComponent)
    
    return cachedComponent
  }

  /**
   * 清除组件解析缓存
   * 用于组件注册变更后的缓存失效
   */
  clearComponentCache(): void {
    this.componentCache.clear()
  }

  /**
   * 使特定组件的缓存失效
   */
  invalidateComponentCache(type: string): void {
    this.componentCache.delete(type)
  }
}
