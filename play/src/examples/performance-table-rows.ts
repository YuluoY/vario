import type { Schema } from '@variojs/schema'

/**
 * 表格行场景
 * ElTable + ElTableColumn + scoped slot 组合
 */
export const createTableRowsSchema = (componentCount: number): Schema => {
  return {
    type: 'div',
    props: { style: 'padding: 16px;' },
    children: [
      {
        type: 'ElTable',
        props: { data: Array.from({ length: componentCount }, (_, i) => ({ id: i, name: `Item ${i}`, value: i * 10 })) },
        children: [
          {
            type: 'ElTableColumn',
            props: { prop: 'id', label: 'ID', width: '80' }
          },
          {
            type: 'ElTableColumn',
            props: { prop: 'name', label: 'Name' }
          },
          {
            type: 'ElTableColumn',
            props: { prop: 'value', label: 'Value' }
          },
          {
            type: 'ElTableColumn',
            props: { label: 'Actions', width: '150' },
            children: [
              {
                type: 'template',
                slot: 'default',
                props: { scope: 'scope' } as any,
                children: [
                  {
                    type: 'ElButton',
                    props: { type: 'primary', size: 'small' },
                    children: 'Edit'
                  },
                  {
                    type: 'ElButton',
                    props: { type: 'danger', size: 'small', style: 'margin-left: 8px;' },
                    children: 'Delete'
                  }
                ]
              } as Schema
            ]
          }
        ]
      }
    ]
  }
}
