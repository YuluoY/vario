export type RuntimeMode = 'legacy' | 'shadow' | 'prepared'

// 默认 legacy：prepared 保持显式 opt-in，符合灰度纪律
// （roadmap：prepared 成为默认是灰度最后一步，须先补全 feature parity）
let mode: RuntimeMode = 'legacy'
const engineModes = new Map<string, RuntimeMode>()

export function getRuntimeMode(engineId?: string): RuntimeMode {
  if (engineId) return engineModes.get(engineId) ?? mode
  return mode
}

export function setRuntimeMode(next: RuntimeMode, scope?: { engineId?: string }): void {
  if (scope?.engineId) {
    engineModes.set(scope.engineId, next)
    return
  }
  mode = next
}

export type { SessionStatus } from './page-session.js'
export { PageSession, getPageSession, getPageSessionForContext, activePageSessionCount } from './page-session.js'
export { VueStateBridge } from './state-bridge.js'
export { compareShadowPlans, type ShadowDiff } from './shadow-comparator.js'
export { evaluateCanary, type CanaryDecision } from './canary-controller.js'
export { detectVueCapabilities, type VueCapabilities } from './vue-capabilities.js'

export { createSsrSession } from '../ssr/create-ssr-session.js'
