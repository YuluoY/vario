import { effectScope } from 'vue'

export type VueCapabilities = {
  effectScopePause: boolean
  version: string
}

export function detectVueCapabilities(): VueCapabilities {
  const scope = effectScope(true)
  const pause = typeof (scope as { pause?: unknown }).pause === 'function'
  const resume = typeof (scope as { resume?: unknown }).resume === 'function'
  scope.stop()
  return {
    effectScopePause: pause && resume,
    version: pause && resume ? '3.5+' : '3.4'
  }
}

export function applyScopePause(scope: { pause?: () => void; stop: () => void }): void {
  if (typeof scope.pause === 'function') scope.pause()
  else scope.stop()
}

export function applyScopeResume(scope: { resume?: () => void }): void {
  scope.resume?.()
}
