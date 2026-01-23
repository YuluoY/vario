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
export * from './types.js'
export * from './features/refs.js'
export * from './features/teleport.js'
export * from './features/provide-inject.js'
