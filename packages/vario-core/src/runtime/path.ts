/**
 * 路径解析工具模块
 *
 * 统一的路径解析逻辑，供 vario-core 和框架集成层使用
 */

import {
  PATH_CACHE_MAX,
  MAX_ARRAY_INDEX,
  isForbiddenSegment,
  hasForbiddenSegment,
  assertWritablePath,
  validatePathBudget,
} from './path-policy.js'

export type { PathSegment } from './path-policy.js'
import type { PathSegment } from './path-policy.js'

type PathCache = {
  parsed: Map<string, readonly PathSegment[]>
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
      if (current) {
        segments.push(parseSegment(current))
        current = ''
      }
      i++
    } else if (char === '[') {
      if (current) {
        segments.push(parseSegment(current))
        current = ''
      }

      const closeIndex = path.indexOf(']', i)
      if (closeIndex === -1) {
        current += char
        i++
      } else {
        const indexStr = path.slice(i + 1, closeIndex)
        if (indexStr === '') {
          segments.push(-1)
        } else if (/^\d+$/.test(indexStr)) {
          segments.push(parseInt(indexStr, 10))
        } else {
          segments.push(indexStr)
        }
        i = closeIndex + 1

        if (path[i] === '.') {
          i++
        }
      }
    } else {
      current += char
      i++
    }
  }

  if (current) {
    segments.push(parseSegment(current))
  }

  return segments
}

function parseSegment(segment: string): PathSegment {
  if (/^\d+$/.test(segment)) {
    return parseInt(segment, 10)
  }
  return segment
}

/**
 * 解析路径（带缓存）。返回冻结只读副本；满 2000 时 LRU 淘汰最旧项，不全表清空。
 */
export function parsePathCached(path: string): readonly PathSegment[] {
  if (!path || path.length === 0) {
    return Object.freeze([])
  }

  const cached = pathCache.parsed.get(path)
  if (cached) {
    pathCache.parsed.delete(path)
    pathCache.parsed.set(path, cached)
    return cached
  }

  const segments = Object.freeze(parsePath(path))
  if (pathCache.parsed.size >= PATH_CACHE_MAX) {
    const oldest = pathCache.parsed.keys().next().value
    if (oldest !== undefined) {
      pathCache.parsed.delete(oldest)
    }
  }
  pathCache.parsed.set(path, segments)
  return segments
}

export function clearPathCache(): void {
  pathCache.parsed.clear()
}

export function stringifyPath(segments: readonly PathSegment[]): string {
  return segments.map(String).join('.')
}

function ownGet(value: object, segment: PathSegment): unknown {
  if (typeof segment === 'number') {
    if (!Array.isArray(value)) return undefined
    if (segment < 0 || segment > MAX_ARRAY_INDEX) return undefined
    return value[segment]
  }
  if (isForbiddenSegment(segment)) {
    return undefined
  }
  // in + Reflect.get：让 Vue reactive 的 get/has 陷阱都收到访问，
  // 尚不存在的键也能被 effect 追踪；原型 getter（class getter/Map.size）可读。
  if (!(segment in value)) {
    return undefined
  }
  return Reflect.get(value, segment)
}

export function getPathValue(
  obj: Record<string, unknown>,
  path: string | readonly PathSegment[]
): unknown {
  const segments = typeof path === 'string' ? parsePathCached(path) : path

  if (segments.length === 0) {
    return obj
  }

  if (hasForbiddenSegment(segments)) {
    return undefined
  }

  let value: unknown = obj

  for (const segment of segments) {
    if (value == null || typeof value !== 'object') {
      return undefined
    }
    value = ownGet(value, segment)
  }

  return value
}

export function setPathValue(
  obj: Record<string, unknown>,
  path: string | readonly PathSegment[],
  value: unknown,
  options: {
    createIntermediate?: boolean
    createObject?: () => Record<string, unknown>
    createArray?: () => unknown[]
  } = {}
): boolean {
  const {
    createIntermediate = true,
    createObject = () => Object.create(null) as Record<string, unknown>,
    createArray = () => [],
  } = options

  const rawPath = typeof path === 'string' ? path : stringifyPath(path)
  const segments = typeof path === 'string' ? parsePathCached(path) : path

  if (segments.length === 0) {
    return false
  }

  try {
    assertWritablePath(rawPath, segments)
  } catch {
    return false
  }

  const budget = validatePathBudget(rawPath, segments)
  if (!budget.ok) return false

  const lastSegment = segments[segments.length - 1]
  const parentSegments = segments.slice(0, -1)

  let target: unknown = obj

  for (let i = 0; i < parentSegments.length; i++) {
    const segment = parentSegments[i]
    const nextSegment = parentSegments[i + 1] ?? lastSegment
    const nextIsArrayIndex = typeof nextSegment === 'number'

    if (typeof segment === 'number') {
      if (!Array.isArray(target)) {
        if (!createIntermediate) return false
        return false
      }
      if (segment < 0 || segment > MAX_ARRAY_INDEX) return false
      if (target[segment] == null || typeof target[segment] !== 'object') {
        if (!createIntermediate) return false
        target[segment] = nextIsArrayIndex ? createArray() : createObject()
      }
      target = target[segment]
    } else {
      if (typeof target !== 'object' || target === null) {
        return false
      }
      if (isForbiddenSegment(segment)) return false
      const targetObj = target as Record<string, unknown>
      if (targetObj[segment] == null || typeof targetObj[segment] !== 'object') {
        if (!createIntermediate) return false
        targetObj[segment] = nextIsArrayIndex ? createArray() : createObject()
      }
      target = targetObj[segment]
    }
  }

  if (typeof lastSegment === 'number') {
    if (!Array.isArray(target)) {
      return false
    }
    if (lastSegment < 0 || lastSegment > MAX_ARRAY_INDEX) return false
    target[lastSegment] = value
  } else {
    if (typeof target !== 'object' || target === null) {
      return false
    }
    if (isForbiddenSegment(lastSegment)) return false
    ;(target as Record<string, unknown>)[lastSegment] = value
  }

  return true
}

export function matchPath(pattern: string, path: string): boolean {
  if (pattern === path) {
    return true
  }

  if (path.startsWith(pattern + '.')) {
    return true
  }

  if (pattern.includes('*')) {
    const parentPath = pattern.split('.*')[0]
    return path.startsWith(parentPath + '.') || path === parentPath
  }

  if (pattern.startsWith(path + '.')) {
    return true
  }

  return false
}

export function getParentPath(path: string): string {
  const segments = parsePathCached(path)
  if (segments.length <= 1) {
    return ''
  }
  return stringifyPath(segments.slice(0, -1))
}

export function getLastSegment(path: string): PathSegment | undefined {
  const segments = parsePathCached(path)
  return segments[segments.length - 1]
}
