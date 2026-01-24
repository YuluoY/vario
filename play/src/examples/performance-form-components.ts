import type { Schema } from '@variojs/schema'

/**
 * 表单组件场景
 * ElForm + ElFormItem + ElInput 组合
 */
export const createFormComponentsSchema = (componentCount: number): Schema => {
  return {
    type: 'ElForm',
    props: { labelWidth: '100px', style: 'padding: 16px;' },
    children: Array.from({ length: componentCount }, (_, j) => ({
      type: 'ElFormItem',
      props: { label: `Field ${j}` },
      children: [
        {
          type: 'ElInput',
          props: { placeholder: `Input ${j}` },
          model: `field${j}`
        }
      ]
    })) as Schema[]
  }
}
