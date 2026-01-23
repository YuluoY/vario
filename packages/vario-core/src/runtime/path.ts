/**
 * 路径解析工具模块
 * 
 * 统一的路径解析逻辑，供 vario-core 和框架集成层使用
 * 
 * 设计原则：
 * - 单一职责：只处理路径解析，不涉及响应式
 * - 可组合：提供原子操作，框架集成层可自由组合
 * - 类型安全：尽可能提供类型推导
 */

/**
 * 路径段类型
 */
export type PathSegment = string | number

type PathCache = {
  parsed: Map<string, PathSegment[]>
}

const pathCache: PathCache = {
  parsed: new Map()
}

/**
 * 解析路径字符串为段数组
 * 
 * 支持两种语法：
 * - 点语法：`user.name` → ['user', 'name']
 * - 括号语法：`users[0].name` → ['users', 0, 'name']
 * - 混合语法：`data.users[0].profile.tags[1]` → ['data', 'users', 0, 'profile', 'tags', 1]
 * - 空括号：`users[].name` → ['users', -1, 'name']（-1 表示动态索引，由循环上下文填充）
 * 
 * @param path 路径字符串
 * @returns 路径段数组
 * 
 * @example
 * parsePath('user.name') // ['user', 'name']
 * parsePath('items.0.text') // ['items', 0, 'text']
 * parsePath('users[0].name') // ['users', 0, 'name']
 * parsePath('users[].name') // ['users', -1, 'name']
 */
export function parsePath(path: string): PathSegment[] {
  if (!path || path.length === 0) {
    return []
  }
  
  const segments: PathSegment[] = []
  let current = ''
  let i = 0
  
  while (i < path.length) {
    const char = path[i]
    
    if (char === '.') {
      // 点分隔符：保存当前段
      if (current) {
        segments.push(parseSegment(current))
        current = ''
      }
      i++
    } else if (char === '[') {
      // 括号开始：保存当前段（如果有），然后解析括号内容
      if (current) {
        segments.push(parseSegment(current))
        current = ''
      }
      
      // 找到匹配的 ]
      const closeIndex = path.indexOf(']', i)
      if (closeIndex === -1) {
        // 没有匹配的 ]，当作普通字符处理
        current += char
        i++
      } else {
        const indexStr = path.slice(i + 1, closeIndex)
        if (indexStr === '') {
          // 空括号 [] 表示动态索引
          segments.push(-1)
        } else if (/^\d+$/.test(indexStr)) {
          // 数字索引
          segments.push(parseInt(indexStr, 10))
        } else {
          // 非数字，当作字符串键
          segments.push(indexStr)
        }
        i = closeIndex + 1
        
        // 跳过紧跟的点
        if (path[i] === '.') {
          i++
        }
      }
    } else {
      current += char
      i++
    }
  }
  
  // 处理最后一段
  if (current) {
    segments.push(parseSegment(current))
  }
  
  return segments
}

/**
 * 解析单个路径段
 */
function parseSegment(segment: string): PathSegment {
  // 纯数字视为数组索引（保持向后兼容 items.0.text 语法）
  if (/^\d+$/.test(segment)) {
    return parseInt(segment, 10)
  }
  return segment
}

/**
 * 解析路径（带缓存）
 *
 * @param path 点分隔的路径字符串
 * @returns 路径段数组
 */
export function parsePathCached(path: string): PathSegment[] {
  if (!path || path.length === 0) {
    return []
  }

  const cached = pathCache.parsed.get(path)
  if (cached) {
    return cached
  }

  const segments = parsePath(path)
  pathCache.parsed.set(path, segments)
  return segments
}

/**
 * 清理路径缓存
 */
export function clearPathCache(): void {
  pathCache.parsed.clear()
}

/**
 * 将路径段数组转换为路径字符串
 * 
 * @param segments 路径段数组
 * @returns 点分隔的路径字符串
 */
export function stringifyPath(segments: PathSegment[]): string {
  return segments.map(String).join('.')
}

/**
 * 获取嵌套路径的值
 * 
 * @param obj 目标对象
 * @param path 路径字符串或路径段数组
 * @returns 路径对应的值，不存在返回 undefined
 */
export function getPathValue(
  obj: Record<string, unknown>,
  path: string | PathSegment[]
): unknown {
  const segments = typeof path === 'string' ? parsePathCached(path) : path
  
  if (segments.length === 0) {
    return obj
  }
  
  let value: unknown = obj
  
  for (const segment of segments) {
    if (value == null) {
      return undefined
    }
    
    if (typeof segment === 'number') {
      // 数组索引
      if (!Array.isArray(value)) {
        return undefined
      }
      value = value[segment]
    } else {
      // 对象属性
      if (typeof value !== 'object') {
        return undefined
      }
      value = (value as Record<string, unknown>)[segment]
    }
  }
  
  return value
}

/**
 * 设置嵌套路径的值
 * 
 * @param obj 目标对象
 * @param path 路径字符串或路径段数组
 * @param value 要设置的值
 * @param options 配置选项
 * @returns 是否设置成功
 */
export function setPathValue(
  obj: Record<string, unknown>,
  path: string | PathSegment[],
  value: unknown,
  options: {
    /**
     * 自动创建中间路径
     * @default true
     */
    createIntermediate?: boolean
    
    /**
     * 创建对象的工厂函数
     * 用于框架集成层创建响应式对象
     */
    createObject?: () => Record<string, unknown>
    
    /**
     * 创建数组的工厂函数
     * 用于框架集成层创建响应式数组
     */
    createArray?: () => unknown[]
  } = {}
): boolean {
  const {
    createIntermediate = true,
    createObject = () => ({}),
    createArray = () => []
  } = options
  
  const segments = typeof path === 'string' ? parsePathCached(path) : path
  
  if (segments.length === 0) {
    return false
  }
  
  const lastSegment = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)
  
  // 找到或创建父对象
  let target: unknown = obj
  
  for (let i = 0; i < parentSegments.length; i++) {
    const segment = parentSegments[i]
    const nextSegment = parentSegments[i + 1] ?? lastSegment
    const nextIsArrayIndex = typeof nextSegment === 'number'
    
    if (typeof segment === 'number') {
      // 当前段是数组索引
      if (!Array.isArray(target)) {
        if (!createIntermediate) return false
        // 无法将非数组转换为数组
        return false
      }
      
      // 确保数组足够长
      while (target.length <= segment) {
        target.push(undefined)
      }
      
      // 确保目标位置是对象或数组
      if (target[segment] == null || typeof target[segment] !== 'object') {
        if (!createIntermediate) return false
        target[segment] = nextIsArrayIndex ? createArray() : createObject()
      }
      
      target = target[segment]
    } else {
      // 当前段是对象属性
      if (typeof target !== 'object' || target === null) {
        return false
      }
      
      const targetObj = target as Record<string, unknown>
      
      if (targetObj[segment] == null || typeof targetObj[segment] !== 'object') {
        if (!createIntermediate) return false
        targetObj[segment] = nextIsArrayIndex ? createArray() : createObject()
      }
      
      target = targetObj[segment]
    }
  }
  
  // 设置最终值
  if (typeof lastSegment === 'number') {
    if (!Array.isArray(target)) {
      return false
    }
    while (target.length <= lastSegment) {
      target.push(undefined)
    }
    target[lastSegment] = value
  } else {
    if (typeof target !== 'object' || target === null) {
      return false
    }
    (target as Record<string, unknown>)[lastSegment] = value
  }
  
  return true
}

/**
 * 检查路径是否匹配（支持通配符）
 * 
 * @param pattern 模式路径（支持 * 通配符）
 * @param path 目标路径
 * @returns 是否匹配
 * 
 * @example
 * matchPath('items.*', 'items.0') // true
 * matchPath('items.*.name', 'items.0.name') // true
 * matchPath('user.name', 'user.name') // true
 * matchPath('user.name', 'user.age') // false
 */
export function matchPath(pattern: string, path: string): boolean {
  // 精确匹配
  if (pattern === path) {
    return true
  }
  
  // 检查是否为父路径
  if (path.startsWith(pattern + '.')) {
    return true
  }
  
  // 通配符匹配
  if (pattern.includes('*')) {
    const parentPath = pattern.split('.*')[0]
    return path.startsWith(parentPath + '.') || path === parentPath
  }
  
  // 检查是否路径影响模式
  if (pattern.startsWith(path + '.')) {
    return true
  }
  
  return false
}

/**
 * 提取路径的父路径
 * 
 * @param path 路径字符串
 * @returns 父路径，顶层路径返回空字符串
 */
export function getParentPath(path: string): string {
  const segments = parsePathCached(path)
  if (segments.length <= 1) {
    return ''
  }
  return stringifyPath(segments.slice(0, -1))
}

/**
 * 获取路径的最后一段
 * 
 * @param path 路径字符串
 * @returns 最后一段
 */
export function getLastSegment(path: string): PathSegment | undefined {
  const segments = parsePathCached(path)
  return segments[segments.length - 1]
}
