/**
 * 集中的路径安全政策：保留段、长度/深度/数组下标预算。
 */

import { PathWriteError, ErrorCodes } from '../errors.js'

export type PathSegment = string | number

export const PATH_CACHE_MAX = 2000
export const MAX_PATH_CHARS = 1024
export const MAX_PATH_SEGMENTS = 20
export const MAX_ARRAY_INDEX = 100_000

export const FORBIDDEN_PATH_SEGMENTS = new Set([
  '__proto__',
  'constructor',
  'prototype',
])

/**
 * 真正的系统根：不可经 _set 写入。
 * $item/$index 与 $variables 等命名空间根不在此列——
 * 词法子路径写入由 loop ctx 决定，命名空间由 proxy 决定。
 */
const SYSTEM_ROOTS = new Set([
  '$emit',
  '$methods',
  '$event',
  '$exprOptions',
  '$self',
  '$parent',
  '$siblings',
  '$children',
  '_get',
  '_set',
])

export function isForbiddenSegment(segment: PathSegment): boolean {
  if (typeof segment !== 'string') return false
  return FORBIDDEN_PATH_SEGMENTS.has(segment)
}

export function isSystemPath(path: string, segments?: readonly PathSegment[]): boolean {
  const segs = segments ?? path.split('.')
  if (segs.length === 0) return false
  const root = String(segs[0])
  if (SYSTEM_ROOTS.has(root)) return true
  return false
}

export function validatePathBudget(
  path: string,
  segments: readonly PathSegment[]
): { ok: true } | { ok: false; reason: string; code: string } {
  if (path.length > MAX_PATH_CHARS) {
    return {
      ok: false,
      reason: `Path exceeds max character length (${MAX_PATH_CHARS})`,
      code: ErrorCodes.PATH_BUDGET_EXCEEDED,
    }
  }
  if (segments.length > MAX_PATH_SEGMENTS) {
    return {
      ok: false,
      reason: `Path exceeds max segment count (${MAX_PATH_SEGMENTS})`,
      code: ErrorCodes.PATH_BUDGET_EXCEEDED,
    }
  }
  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (!Number.isInteger(segment) || segment < 0 || segment > MAX_ARRAY_INDEX) {
        return {
          ok: false,
          reason: `Array index ${segment} exceeds max (${MAX_ARRAY_INDEX})`,
          code: ErrorCodes.PATH_BUDGET_EXCEEDED,
        }
      }
    }
  }
  return { ok: true }
}

export function assertWritablePath(path: string, segments: readonly PathSegment[]): void {
  for (const segment of segments) {
    if (isForbiddenSegment(segment)) {
      throw new PathWriteError(
        path,
        `Forbidden path segment "${String(segment)}"`,
        ErrorCodes.PATH_FORBIDDEN_SEGMENT
      )
    }
    // 未解析的动态下标（loop 的 [] 语法）：写入时必须先解析为具体索引
    if (segment === -1) {
      throw new PathWriteError(
        path,
        `Path contains unresolved dynamic index "[]"`,
        ErrorCodes.PATH_UNRESOLVED_INDEX
      )
    }
  }
  if (isSystemPath(path, segments)) {
    throw new PathWriteError(
      path,
      `Cannot write system path "${path}"`,
      ErrorCodes.PATH_FORBIDDEN_SEGMENT
    )
  }
  const budget = validatePathBudget(path, segments)
  if (!budget.ok) {
    throw new PathWriteError(path, budget.reason, budget.code)
  }
}

export function hasForbiddenSegment(segments: readonly PathSegment[]): boolean {
  return segments.some(isForbiddenSegment)
}
