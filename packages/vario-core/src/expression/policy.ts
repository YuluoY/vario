/**
 * 表达式安全策略：validator 与 evaluator 共用精确方法表。
 */

import type * as ESTree from '@babel/types'
import type { ExpressionOptions, RuntimeContext } from '@variojs/types'

export const WHITELISTED_GLOBALS = new Set([
  'String', 'Number', 'Boolean',
  'Array', 'Object', 'Math', 'Date', 'JSON',
])

export const WHITELISTED_FUNCTIONS = new Set([
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
  'Math.max',
  'Math.min',
  'Math.random',
  'Date.now',
  'JSON.parse',
  'JSON.stringify',
  'String',
  'Number',
  'Boolean',
])

export const SAFE_ARRAY_METHODS = new Set([
  'slice',
  'concat',
  'filter',
  'map',
  'flat',
  'flatMap',
  'toReversed',
  'toSorted',
  'toSpliced',
  'with',
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
  'join',
  'toString',
  'toLocaleString',
  'reduce',
])

export const FORBIDDEN_OBJECT_METHODS = new Set([
  'assign',
  'setPrototypeOf',
  'defineProperty',
  'defineProperties',
  'getOwnPropertyDescriptor',
  'getPrototypeOf',
])

export const DANGEROUS_FUNCTIONS = new Set([
  'eval',
  'Function',
  'setTimeout',
  'setInterval',
  'execScript',
])

export const IMPURE_FUNCTIONS = new Set([
  'Date.now',
  'Math.random',
])

export const ALLOWED_CAPABILITY_ROOTS = new Set(['$functions', '$utils'])

const FORBIDDEN_CAPABILITY_METHODS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'then',
  'toJSON',
  'valueOf',
  'toString'
])

export type CapabilitySpec = {
  readonly name: string
  readonly pure: boolean
  readonly cost: number
  readonly inputLimit: number
  readonly allowInExpression: boolean
  readonly impl: (...args: unknown[]) => unknown
}

const capabilityRegistry = new Map<string, CapabilitySpec>()
const engineCapabilities = new Map<string, Map<string, CapabilitySpec>>()
const contextEngines = new WeakMap<object, string>()

export function bindContextEngine(ctx: object, engineId: string): void {
  contextEngines.set(ctx, engineId)
}

export function registerCapability(spec: CapabilitySpec, options?: { engineId?: string }): void {
  if (!spec.name) {
    throw new Error('Capability name is required')
  }
  const [root, method, ...rest] = spec.name.split('.')
  if (rest.length > 0 || !root || !method) {
    throw new Error(`Capability name must be "$utils.method" or "$functions.method"`)
  }
  if (!ALLOWED_CAPABILITY_ROOTS.has(root)) {
    throw new Error(`Capability root must be $functions or $utils, got "${root}"`)
  }
  if (FORBIDDEN_CAPABILITY_METHODS.has(method)) {
    throw new Error(`Capability "${spec.name}" is forbidden`)
  }
  if (typeof spec.pure !== 'boolean' || typeof spec.allowInExpression !== 'boolean') {
    throw new Error(`Capability "${spec.name}" must mark pure and allowInExpression`)
  }
  if (!Number.isFinite(spec.cost) || spec.cost < 0 || !Number.isFinite(spec.inputLimit) || spec.inputLimit < 0) {
    throw new Error(`Capability "${spec.name}" must mark non-negative cost and inputLimit`)
  }
  if (typeof spec.impl !== 'function') {
    throw new Error(`Capability "${spec.name}" requires impl`)
  }
  const frozen = Object.freeze({ ...spec })
  if (options?.engineId) {
    let table = engineCapabilities.get(options.engineId)
    if (!table) {
      table = new Map()
      engineCapabilities.set(options.engineId, table)
    }
    table.set(spec.name, frozen)
    return
  }
  capabilityRegistry.set(spec.name, frozen)
}

export function getCapability(name: string, engineId?: string): CapabilitySpec | undefined {
  if (engineId) {
    const overlay = engineCapabilities.get(engineId)?.get(name)
    if (overlay) return overlay
  }
  return capabilityRegistry.get(name)
}

function resolveCapability(name: string, ctx?: object): CapabilitySpec | undefined {
  const engineId = ctx ? contextEngines.get(ctx) : undefined
  if (engineId) {
    const overlay = engineCapabilities.get(engineId)?.get(name)
    if (overlay) return overlay
  }
  return capabilityRegistry.get(name)
}

export function listCapabilities(): readonly CapabilitySpec[] {
  return [...capabilityRegistry.values()]
}

export const RUNTIME_HELPERS: Record<string, (...args: unknown[]) => unknown> = {
  '$truncate': (str: unknown, length: unknown): unknown => {
    if (typeof str !== 'string') return str
    const len = typeof length === 'number' ? length : 0
    return str.length > len ? str.slice(0, len) + '...' : str
  },
  '$format': (date: unknown, _format?: unknown): unknown => {
    const d = typeof date === 'number' ? new Date(date) : (date as Date)
    return d.toISOString()
  },
}

export function getPolicyFingerprint(options?: ExpressionOptions): string {
  const allowGlobals = options?.allowGlobals === true
  const maxNestingDepth = options?.maxNestingDepth ?? 50
  const maxSteps = options?.maxSteps ?? 1000
  return `v1:g=${allowGlobals ? 1 : 0}:d=${maxNestingDepth}:s=${maxSteps}`
}

export function isExactWhitelistedFunction(funcName: string): boolean {
  return WHITELISTED_FUNCTIONS.has(funcName) || RUNTIME_HELPERS[funcName] !== undefined
}

/**
 * 白名单全局对象（String/Number/Boolean/Array/Object/Math/Date/JSON）上的
 * 静态方法调用放行（恢复 HEAD 可用面）；Object 的危险方法仍禁止。
 */
export function isWhitelistedGlobalStaticCall(funcName: string): boolean {
  const dot = funcName.indexOf('.')
  if (dot <= 0) return false
  const root = funcName.slice(0, dot)
  const method = funcName.slice(dot + 1)
  if (!method || method.includes('.')) return false
  if (!WHITELISTED_GLOBALS.has(root)) return false
  if (root === 'Object' && FORBIDDEN_OBJECT_METHODS.has(method)) return false
  return true
}

export function isSafeArrayMethod(name: string): boolean {
  return SAFE_ARRAY_METHODS.has(name)
}

export function isRegisteredCapabilityCall(
  ctx: RuntimeContext,
  rootName: string,
  methodName: string
): boolean {
  if (FORBIDDEN_CAPABILITY_METHODS.has(methodName)) return false
  const registered = resolveCapability(`${rootName}.${methodName}`, ctx)
    ?? resolveCapability(methodName, ctx)
  return Boolean(registered?.allowInExpression)
}

export function invokeCapability(rootName: string, methodName: string, args: unknown[], ctx?: RuntimeContext): unknown {
  if (FORBIDDEN_CAPABILITY_METHODS.has(methodName)) {
    throw new Error(`Capability "${rootName}.${methodName}" is forbidden`)
  }
  const registered = resolveCapability(`${rootName}.${methodName}`, ctx)
    ?? resolveCapability(methodName, ctx)
  if (!registered?.allowInExpression) {
    throw new Error(`Capability "${rootName}.${methodName}" is not registered for expressions`)
  }
  if (args.length > registered.inputLimit) {
    throw new Error(`Capability "${rootName}.${methodName}" exceeded inputLimit ${registered.inputLimit}`)
  }
  return registered.impl(...args)
}

export function isPureAst(ast: ESTree.Node): boolean {
  let impure = false
  walk(ast, (node) => {
    if (node.type === 'CallExpression') {
      const name = calleeName(node.callee)
      if (name && IMPURE_FUNCTIONS.has(name)) {
        impure = true
      }
    }
  })
  return !impure
}

function calleeName(callee: ESTree.Node): string | null {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && !callee.computed) {
    const obj = callee.object
    const prop = callee.property
    if (obj.type === 'Identifier' && prop.type === 'Identifier') {
      return `${obj.name}.${prop.name}`
    }
  }
  return null
}

function walk(node: ESTree.Node, visit: (n: ESTree.Node) => void): void {
  visit(node)
  for (const key in node) {
    const value = (node as unknown as Record<string, unknown>)[key]
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in (child as object)) {
          walk(child as ESTree.Node, visit)
        }
      }
    } else if (typeof value === 'object' && 'type' in (value as object)) {
      walk(value as ESTree.Node, visit)
    }
  }
}
