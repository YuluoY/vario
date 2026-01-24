/**
 * 计算器应用示例 - 使用 vario-vue Composition API
 */

import { useVario, type MethodContext } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import type { App } from 'vue'

interface CalculatorState extends Record<string, unknown> {
  display: string
  previousValue: number | null
  operator: string | null
  waitingForOperand: boolean
  history: Array<{ expression: string; result: number }>
}

export function createCalculator(app?: App | null) {

  const calculatorSchema: Schema<CalculatorState> = {
    type: 'div',
    props: { class: 'calculator-demo', style: 'padding: 24px; max-width: 400px; margin: 0 auto;' },
    children: [
      { type: 'h2', props: { style: 'margin-bottom: 24px; text-align: center;' }, children: '计算器' },
      {
        type: 'ElCard',
        props: { shadow: 'hover' },
        children: [
          { type: 'div', props: { style: 'background: #f5f5f5; padding: 20px; border-radius: 4px; margin-bottom: 20px; text-align: right; font-size: 32px; font-family: monospace; min-height: 60px; display: flex; align-items: center; justify-content: flex-end;' }, children: '{{ display || "0" }}' },
          {
            type: 'div',
            props: { style: 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;' },
            children: [
              { type: 'ElButton', props: { type: 'danger', style: 'grid-column: span 2;' }, events: { click: [{ type: 'call', method: 'clear' }] }, children: '清除' },
              { type: 'ElButton', props: { type: 'warning' }, events: { click: [{ type: 'call', method: 'handleOperator', params: { op: '/' } }] }, children: '÷' },
              { type: 'ElButton', props: { type: 'warning' }, events: { click: [{ type: 'call', method: 'handleOperator', params: { op: '*' } }] }, children: '×' },

              // 数字行 1
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '7' } }] }, children: '7' },
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '8' } }] }, children: '8' },
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '9' } }] }, children: '9' },
              { type: 'ElButton', props: { type: 'warning' }, events: { click: [{ type: 'call', method: 'handleOperator', params: { op: '-' } }] }, children: '−' },

              // 数字行 2
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '4' } }] }, children: '4' },
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '5' } }] }, children: '5' },
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '6' } }] }, children: '6' },
              { type: 'ElButton', props: { type: 'warning' }, events: { click: [{ type: 'call', method: 'handleOperator', params: { op: '+' } }] }, children: '+' },

              // 数字行 3
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '1' } }] }, children: '1' },
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '2' } }] }, children: '2' },
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '3' } }] }, children: '3' },
              { type: 'ElButton', props: { type: 'primary', style: 'grid-row: span 2;' }, events: { click: [{ type: 'call', method: 'calculate' }] }, children: '=' },

              // 数字行 4
              { type: 'ElButton', props: { style: 'grid-column: span 2;' }, events: { click: [{ type: 'call', method: 'inputNumber', params: { num: '0' } }] }, children: '0' },
              { type: 'ElButton', events: { click: [{ type: 'call', method: 'inputDecimal' }] }, children: '.' }
            ]
          },

          // 历史记录
          {
            type: 'div',
            cond: '{{ history.length > 0 }}',
            props: { style: 'margin-top: 20px; padding-top: 20px; border-top: 1px solid #ebeef5;' },
            children: [
              { type: 'h4', props: { style: 'margin-bottom: 12px; font-size: 14px; color: #909399;' }, children: '历史记录' },
              {
                type: 'div',
                loop: { items: '{{ history.slice().reverse() }}', itemKey: 'item' },
                props: { style: 'padding: 8px; margin-bottom: 4px; background: #f5f7fa; border-radius: 4px; font-size: 12px; font-family: monospace;' },
                children: '{{ item.expression }} = {{ item.result }}'
              }
            ]
          }
        ]
      }
    ]
  }

  const { vnode, state, ctx } = useVario(calculatorSchema, {
    app,
    state: {
      display: '0',
      previousValue: null,
      operator: null,
      waitingForOperand: false,
      history: [],
      a: '123'
    },
    methods: {
      inputNumber: ({ state, params }: MethodContext<CalculatorState>) => {
        const display = state.display
        if (state.waitingForOperand) {
          state.display = params.num
          state.waitingForOperand = false
        } else {
          state.display = display === '0' ? params.num : display + params.num
        }
      },
      inputDecimal: ({ state }: MethodContext<CalculatorState>) => {
        if (state.waitingForOperand) {
          state.display = '0.'
          state.waitingForOperand = false
        } else if (!state.display.includes('.')) {
          state.display += '.'
        }
      },
      clear: ({ state }: MethodContext<CalculatorState>) => {
        state.display = '0'
        state.previousValue = null
        state.operator = null
        state.waitingForOperand = false
      },
      handleOperator: ({ state, params }: MethodContext<CalculatorState>) => {
        const currentValue = parseFloat(state.display)
        if (state.previousValue === null) {
          state.previousValue = currentValue
        } else if (state.operator) {
          const result = performCalculation(state.previousValue, currentValue, state.operator)
          state.display = String(result)
          state.previousValue = result
        }
        state.waitingForOperand = true
        state.operator = params.op
      },
      calculate: ({ state, ctx }: MethodContext<CalculatorState>) => {
        const currentValue = parseFloat(state.display)
        if (state.previousValue !== null && state.operator) {
          const result = performCalculation(state.previousValue, currentValue, state.operator)
          const expression = `${state.previousValue} ${state.operator} ${currentValue}`
          state.display = String(result)
          state.previousValue = null
          state.operator = null
          state.waitingForOperand = true
          // 使用 ctx._set 确保状态同步和响应式更新
          const newHistory = [...state.history, { expression, result }]
          ctx._set('history', newHistory)
        }
      }
    },
    onError: (error: Error) => console.error('[Calculator] Error:', error)
  })

  return { vnode, state, ctx }
}

function performCalculation(prev: number, current: number, operator: string): number {
  switch (operator) {
    case '+': return prev + current
    case '-': return prev - current
    case '*': return prev * current
    case '/': return current !== 0 ? prev / current : 0
    default: return current
  }
}
