import { h, defineComponent, onErrorCaptured, ref, type VNode } from 'vue'
import { getPageSession } from '../../runtime/page-session.js'
import { recordRuntimeMetric } from '../../runtime/runtime-metrics.js'

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

export const VarioErrorBoundary = defineComponent({
  name: 'VarioErrorBoundary',
  props: {
    fallback: { type: Function, default: null },
    onCaptured: { type: Function, default: null },
    sessionId: { type: String, default: '' },
    nodeId: { type: String, default: '' }
  },
  setup(props: {
    fallback?: (error: Error) => VNode
    onCaptured?: (error: Error) => void
    sessionId?: string
    nodeId?: string
  }, { slots }) {
    const err = ref<Error | null>(null)
    onErrorCaptured((error) => {
      const captured = error instanceof Error ? error : new Error(String(error))
      err.value = captured
      const session = props.sessionId ? getPageSession(props.sessionId) : undefined
      if (session) {
        recordRuntimeMetric({
          name: 'render-error',
          sessionId: session.id,
          nodeId: props.nodeId,
          engineId: session.runtime.engineId,
          pageId: session.id,
          schemaId: session.view?.id,
          revision: session.view?.revision
        }, session.sink)
        session.sink.emit({
          name: 'render-error',
          sessionId: session.id,
          nodeId: props.nodeId,
          engineId: session.runtime.engineId,
          pageId: session.id,
          schemaId: session.view?.id,
          revision: session.view?.revision,
          diagnostic: {
            code: 'RENDER_ERROR',
            message: 'render-error',
            path: '',
            phase: 'render',
            engineId: session.runtime.engineId,
            pageId: session.id,
            schemaId: session.view?.id,
            revision: session.view?.revision,
            nodeId: props.nodeId
          }
        })
      }
      props.onCaptured?.(captured)
      return false
    })
    return () => {
      if (err.value) {
        return props.fallback
          ? props.fallback(err.value)
          : createDefaultErrorVNode(err.value, () => { err.value = null })
      }
      return slots.default?.()
    }
  }
})
