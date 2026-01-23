/**
 * 计数器示例 - 展示基础状态管理和事件处理
 */

import { useVario } from '@vario/vue'
import type { Schema } from '@vario/schema'
import type { App } from 'vue'

interface CounterState extends Record<string, unknown> {
  count: number
  step: number
  history: number[]
}

export function createCounter(app?: App | null) {
  const counterSchema: Schema<CounterState> = {
    type: 'div',
    props: {
      class: 'counter-demo',
      style: 'padding: 24px; max-width: 500px; margin: 0 auto; text-align: center;'
    },
    children: [
      {
        type: 'h2',
        props: { style: 'margin: 0 0 24px 0; font-size: 28px; font-weight: 600;' },
        children: '计数器示例'
      },
      {
        type: 'ElCard',
        props: {
          shadow: 'hover',
          style: 'margin-bottom: 20px;'
        },
        children: [
          {
            type: 'div',
            props: { style: 'font-size: 48px; font-weight: bold; color: #409eff; margin: 20px 0;' },
            children: '{{ count }}'
          },
          {
            type: 'ElSpace',
            props: {
              direction: 'horizontal',
              size: 'large',
              style: 'justify-content: center; margin-bottom: 20px;'
            },
            children: [
              {
                type: 'ElButton',
                props: {
                  type: 'danger',
                  size: 'large',
                  icon: 'Minus'
                },
                events: {
                  click: [
                    { type: 'call', method: 'decrement' }
                  ]
                },
                children: '减少'
              },
              {
                type: 'ElButton',
                props: {
                  type: 'primary',
                  size: 'large',
                  icon: 'Plus'
                },
                events: {
                  click: [
                    { type: 'call', method: 'increment' }
                  ]
                },
                children: '增加'
              }
            ]
          },
          {
            type: 'ElDivider',
            props: { contentPosition: 'left' },
            children: '步长设置'
          },
          {
            type: 'ElInputNumber',
            props: {
              vModel: 'step',
              min: 1,
              max: 10,
              style: 'width: 200px;'
            },
            model: 'step'
          }
        ]
      },
      {
        type: 'ElCard',
        props: {
          shadow: 'never',
          header: '操作历史'
        },
        children: [
          {
            type: 'div',
            cond: '{{ history.length === 0 }}',
            props: { style: 'color: #909399; padding: 20px;' },
            children: '暂无历史记录'
          },
          {
            type: 'div',
            loop: {
              items: '{{ history }}',
              itemKey: 'value',
              indexKey: 'index'
            },
            props: {
              style: 'padding: 8px; margin: 4px 0; background: #f5f7fa; border-radius: 4px;'
            },
            children: '第 {{ $index + 1 }} 次: {{ value }}'
          },
          {
            type: 'ElButton',
            props: {
              type: 'warning',
              size: 'small',
              style: 'margin-top: 12px;',
              disabled: '{{ history.length === 0 }}'
            },
            events: {
              click: [
                { type: 'call', method: 'clearHistory' }
              ]
            },
            children: '清空历史'
          }
        ]
      }
    ]
  }

  const initialState: CounterState = {
    count: 0,
    step: 1,
    history: []
  }

  const { vnode, state, ctx } = useVario(counterSchema, {
    app,
    state: initialState,
    methods: {
      increment: ({ state }) => {
        state.count += state.step
        state.history.push(state.count)
      },
      decrement: ({ state }) => {
        state.count -= state.step
        state.history.push(state.count)
      },
      clearHistory: ({ state }) => {
        state.history = []
      }
    },
    onError: (error) => {
      console.error('[Counter] Error:', error)
    }
  })

  return {
    vnode,
    state,
    ctx
  }
}
