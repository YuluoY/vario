/**
 * Vario Vue Renderer
 * 
 * Vue 3 integration backend for rendering Vario Schemas.
 * 
 * 深度集成 Vue 3 特性：
 * - ref: 模板引用（声明映射到 Vue ref）
 * - 生命周期钩子（声明映射到 Vue 钩子）
 * - provide/inject: 依赖注入（声明映射到 Vue API）
 * - teleport: 传送
 * - transition: 过渡动画
 * - keep-alive: 缓存
 * 
 * 注意：computed 和 watch 应该在 Vue 组件中使用原生 API 定义，
 * 然后通过 useVario 的 computed 选项传入
 */

export * from './renderer.js'
export * from './composable.js'
export * from './bindings.js'
export * from './adapter.js'
export * from './types.js'
export * from './features/refs.js'
export * from './features/teleport.js'
export * from './features/provide-inject.js'
export * from './plugins/index.js'
export { VarioRoot } from './components/vario-root.js'
export { VarioNode } from './components/vario-node.js'
export { useVarioPages } from './composables/useVarioPages.js'
export { StaticRegion } from './components/static-region.js'
export { DynamicRegion } from './components/dynamic-region.js'
export { LoopRegion } from './components/loop-region.js'
export { LoopItemCell } from './components/loop-item-cell.js'
export { VarioLifecycleBoundary } from './components/lifecycle-boundary.js'
export { VarioErrorBoundary } from './components/error-boundary.js'
export {
  getRuntimeMode,
  setRuntimeMode,
  PageSession,
  getPageSessionForContext,
  compareShadowPlans,
  evaluateCanary,
  detectVueCapabilities,
  createSsrSession,
  activePageSessionCount
} from './runtime/runtime-mode.js'
export { renderSsrToString, hydrateVarioApp } from './ssr/index.js'
export { recordRuntimeMetric, recordInteractionBudget } from './runtime/runtime-metrics.js'
export { adaptLegacySchema } from './runtime/legacy-prepared-adapter.js'
export { createReferenceVirtualAdapter } from './runtime/virtual-list-adapter.js'
export type { VirtualListAdapter } from './runtime/virtual-list-adapter.js'
export { evaluateCanary as applyCanary } from './runtime/canary-controller.js'
