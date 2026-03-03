import { h, type VNode } from 'vue'

/**
 * 创建 useVario 默认错误展示节点
 *
 * 设计说明：
 * - 作为 errorBoundary.fallback 未提供（或 fallback 本身报错）时的兜底 UI
 * - 通过 onRetry 回调把“重试”行为回传给调用方，保持该工具函数无状态
 */
export function createDefaultErrorVNode(error: Error, onRetry: () => void): VNode {
  return h('div', {
    style: {
      padding: '20px',
      border: '2px solid #f56565',
      borderRadius: '4px',
      backgroundColor: '#fff5f5',
      color: '#c53030'
    }
  }, [
    h('div', { style: { fontWeight: 'bold', marginBottom: '10px' } }, '渲染错误'),
    h('div', { style: { marginBottom: '10px' } }, error.message),
    h('button', {
      onClick: onRetry,
      style: {
        padding: '8px 16px',
        backgroundColor: '#4299e1',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }
    }, '重试')
  ])
}
