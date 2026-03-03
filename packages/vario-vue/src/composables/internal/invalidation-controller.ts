/**
 * Reactive 失效控制器（路径优先 + 全量兜底）
 *
 * 设计目标：
 * - 将 composable 中复杂的“路径采集/索引/失效决策”逻辑集中管理
 * - 对外暴露最小接口，保持 useVario 主流程可读性
 * - 行为与现有实现保持一致（不改变使用方式）
 */

export interface InvalidationController {
  /** 标记：下一次 reactive watch 回调应被跳过（由 ctx._set 触发时使用） */
  markSkipOnce: () => void
  /** 消费并返回是否应跳过本次 watch 回调 */
  consumeSkipOnce: () => boolean
  /** 从 watch onTrigger 事件采集潜在变更路径 */
  collectFromTrigger: (target: unknown, key: unknown) => void
  /**
   * 按当前采集结果执行失效
   * - 优先按路径失效
   * - 无路径时兜底全量失效
   */
  flushPending: (onInvalidatePath: (path: string) => void, onInvalidateAll: () => void) => void
}

/**
 * 创建 Reactive 失效控制器
 */
export function createInvalidationController<TState extends Record<string, unknown>>(
  reactiveState: TState,
  toRawValue: (value: object) => unknown,
  maxIndexDepth = 6
): InvalidationController {
  let skipReactiveWatchOnce = false
  const pendingInvalidatePaths = new Set<string>()
  let forceInvalidateAll = false

  // 对象引用 -> 路径索引（用于将 onTrigger 的 target/key 还原为完整路径）
  let pathIndex = new WeakMap<object, string>()
  let pathIndexDirty = true

  const isTrackableObject = (value: unknown): value is object =>
    value !== null && typeof value === 'object'

  const normalizePath = (path: string): string =>
    path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '')

  const queueInvalidatePath = (path: string): void => {
    const normalized = normalizePath(path)
    if (!normalized || normalized.startsWith('$') || normalized.startsWith('_')) return
    pendingInvalidatePaths.add(normalized)
  }

  const indexObjectPath = (value: unknown, path: string, depth: number): void => {
    if (!isTrackableObject(value)) return

    const obj = value as object
    const raw = toRawValue(obj)
    if (!pathIndex.has(obj)) pathIndex.set(obj, path)
    if (isTrackableObject(raw) && !pathIndex.has(raw)) pathIndex.set(raw, path)
    if (depth >= maxIndexDepth) return

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        indexObjectPath(value[index], `${path}.${index}`, depth + 1)
      }
      return
    }

    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      indexObjectPath(childValue, `${path}.${childKey}`, depth + 1)
    }
  }

  const rebuildPathIndex = (): void => {
    pathIndex = new WeakMap<object, string>()
    for (const [topKey, topValue] of Object.entries(reactiveState as Record<string, unknown>)) {
      if (topKey.startsWith('$') || topKey.startsWith('_')) continue
      indexObjectPath(topValue, topKey, 0)
    }
    pathIndexDirty = false
  }

  const tryResolveTriggerPath = (target: unknown, key: unknown): string | null => {
    if (typeof key !== 'string' && typeof key !== 'number') return null

    if (pathIndexDirty) rebuildPathIndex()

    if (
      target === reactiveState ||
      (isTrackableObject(target) && toRawValue(target as object) === toRawValue(reactiveState as unknown as object))
    ) {
      return String(key)
    }

    if (!isTrackableObject(target)) return null
    const targetObject = target as object
    const rawTarget = toRawValue(targetObject)
    const parentPath = pathIndex.get(targetObject) || (isTrackableObject(rawTarget) ? pathIndex.get(rawTarget) : undefined)
    if (!parentPath) return null

    const keySegment = String(key)
    if (keySegment === 'length' && Array.isArray(target)) {
      return parentPath
    }

    return `${parentPath}.${keySegment}`
  }

  return {
    markSkipOnce: () => {
      skipReactiveWatchOnce = true
    },
    consumeSkipOnce: () => {
      if (!skipReactiveWatchOnce) return false
      skipReactiveWatchOnce = false
      return true
    },
    collectFromTrigger: (target: unknown, key: unknown) => {
      const path = tryResolveTriggerPath(target, key)
      if (path) {
        queueInvalidatePath(path)
        return
      }
      forceInvalidateAll = true
    },
    flushPending: (onInvalidatePath, onInvalidateAll) => {
      if (!forceInvalidateAll && pendingInvalidatePaths.size > 0) {
        for (const path of pendingInvalidatePaths) {
          onInvalidatePath(path)
        }
      } else {
        onInvalidateAll()
      }

      pendingInvalidatePaths.clear()
      forceInvalidateAll = false
      pathIndexDirty = true
    }
  }
}
