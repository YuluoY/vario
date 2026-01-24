/**
 * 表单应用示例 - 使用 vario-vue Composition API
 */

import { useVario, type MethodContext } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import type { App } from 'vue'

interface FormState extends Record<string, unknown> {
  name: string
  email: string
  age: number | null
  gender: 'male' | 'female' | 'other' | ''
  bio: string
  newsletter: boolean
  notifications: boolean
  theme: 'light' | 'dark' | 'auto'
  isSubmitting: boolean
  submitSuccess: boolean
  errors?: Record<string, string>
  isValid?: boolean
  characterCount?: number
}

export function createFormDemo(app?: App | null) {
  const formSchema: Schema<FormState> = {
    type: 'div',
    props: {
      class: 'form-demo',
      style: 'padding: 24px; max-width: 600px; margin: 0 auto;'
    },
    children: [
      { type: 'h2', props: { style: 'margin-bottom: 24px;' }, children: '用户信息表单' },

      {
        type: 'ElAlert',
        cond: '{{ submitSuccess }}',
        props: { type: 'success', title: '提交成功！', style: 'margin-bottom: 20px;' }
      },

      {
        type: 'ElCard',
        props: { shadow: 'hover' },
        children: [
          {
            type: 'ElForm',
            props: { labelWidth: '100px' },
            children: [
              // 姓名
              {
                type: 'ElFormItem',
                props: { label: '姓名', error: '{{ errors.name }}' },
                children: [{ type: 'ElInput', model: 'name', props: { placeholder: '请输入姓名', clearable: true } }]
              },
              // 邮箱
              {
                type: 'ElFormItem',
                props: { label: '邮箱', error: '{{ errors.email }}' },
                children: [{ type: 'ElInput', model: 'email', props: { type: 'email', placeholder: '请输入邮箱', clearable: true } }]
              },
              // 年龄
              {
                type: 'ElFormItem',
                props: { label: '年龄', error: '{{ errors.age }}' },
                children: [{ type: 'ElInputNumber', model: 'age', props: { min: 0, max: 150, placeholder: '请输入年龄' } }]
              },
              // 性别
              {
                type: 'ElFormItem',
                props: { label: '性别' },
                children: [
                  {
                    type: 'ElRadioGroup',
                    model: 'gender',
                    children: [
                      { type: 'ElRadio', props: { label: 'male' }, children: '男' },
                      { type: 'ElRadio', props: { label: 'female' }, children: '女' },
                      { type: 'ElRadio', props: { label: 'other' }, children: '其他' }
                    ]
                  }
                ]
              },
              // 个人简介
              {
                type: 'ElFormItem',
                props: { label: '个人简介' },
                children: [
                  {
                    type: 'ElInput',
                    model: 'bio',
                    props: { type: 'textarea', rows: 4, placeholder: '请输入个人简介', maxlength: 200, showWordLimit: true }
                  },
                  {
                    type: 'div',
                    props: { style: 'font-size: 12px; color: #909399; margin-top: 4px;' },
                    children: '已输入 {{ characterCount }} / 200 字符'
                  }
                ]
              },
              // 主题选择
              {
                type: 'ElFormItem',
                props: { label: '主题' },
                children: [
                  {
                    type: 'ElSelect',
                    model: 'theme',
                    props: { placeholder: '请选择主题' },
                    children: [
                      { type: 'ElOption', props: { value: 'light', label: '浅色' } },
                      { type: 'ElOption', props: { value: 'dark', label: '深色' } },
                      { type: 'ElOption', props: { value: 'auto', label: '自动' } }
                    ]
                  }
                ]
              },
              // 偏好设置
              {
                type: 'ElFormItem',
                props: { label: '偏好设置' },
                children: [
                  {
                    type: 'div',
                    props: { style: 'display: flex; flex-direction: column; gap: 12px;' },
                    children: [
                      { type: 'ElCheckbox', model: 'newsletter', children: '订阅邮件通知' },
                      { type: 'ElCheckbox', model: 'notifications', children: '启用推送通知' }
                    ]
                  }
                ]
              },
              // 提交按钮
              {
                type: 'ElFormItem',
                children: [
                  {
                    type: 'ElButton',
                    props: { type: 'primary', loading: '{{ isSubmitting }}', disabled: '{{ !isValid }}' },
                    events: { click: [{ type: 'call', method: 'submitForm' }] },
                    children: '提交'
                  },
                  {
                    type: 'ElButton',
                    props: { style: 'margin-left: 12px;' },
                    events: { click: [{ type: 'call', method: 'resetForm' }] },
                    children: '重置'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }

  const initialState: FormState = {
    name: '',
    email: '',
    age: null,
    gender: '',
    bio: '',
    newsletter: false,
    notifications: false,
    theme: 'auto',
    isSubmitting: false,
    submitSuccess: false
  }

  const { vnode, state, ctx } = useVario(formSchema, {
    app,
    state: initialState,
    computed: {
      errors: (s) => {
        const errors: Record<string, string> = {}
        if (!s.name?.trim()) errors.name = '姓名不能为空'
        else if (s.name.length < 2) errors.name = '姓名至少需要2个字符'
        if (!s.email?.trim()) errors.email = '邮箱不能为空'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) errors.email = '邮箱格式不正确'
        if (s.age === null || s.age === undefined) errors.age = '年龄不能为空'
        else if (s.age < 0 || s.age > 150) errors.age = '年龄必须在0-150之间'
        return errors
      },
      isValid: (s) => Object.keys((s as any).errors || {}).length === 0,
      characterCount: (s) => (s.bio || '').length
    },
    methods: {
      submitForm: async ({ state }: MethodContext<FormState>) => {
        state.isSubmitting = true
        state.submitSuccess = false
        if (!state.isValid) {
          state.isSubmitting = false
          return
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
        state.isSubmitting = false
        state.submitSuccess = true
        setTimeout(() => { state.submitSuccess = false }, 3000)
      },
      resetForm: ({ state }: MethodContext<FormState>) => {
        Object.assign(state, initialState)
      }
    },
    onError: (error: Error) => console.error('[FormDemo] Error:', error)
  })

  return { vnode, state, ctx }
}
