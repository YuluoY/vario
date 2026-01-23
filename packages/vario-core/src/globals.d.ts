/**
 * 全局类型声明
 * 用于支持跨平台代码（Node.js 和浏览器）
 */

// 声明全局变量，避免 TypeScript 错误（使用 any 以避免 DOM lib 依赖）
declare const window: any
declare const document: any
declare const self: any
declare const global: typeof globalThis | undefined
