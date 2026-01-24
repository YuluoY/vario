/**
 * 数据表格应用示例 - 使用 vario-vue Composition API
 */

import { useVario, type MethodContext } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import type { App } from 'vue'

interface Product {
  id: number
  name: string
  category: string
  price: number
  stock: number
  status: 'active' | 'inactive'
}

interface DataTableState extends Record<string, unknown> {
  products: Product[]
  searchKeyword: string
  selectedCategory: string
  selectedStatus: 'all' | 'active' | 'inactive'
  sortField: keyof Product | ''
  sortOrder: 'asc' | 'desc'
  currentPage: number
  pageSize: number
  selectedIds: number[]
  selectAll: boolean
  filteredProducts?: Product[]
  sortedProducts?: Product[]
  paginatedProducts?: Product[]
  totalPages?: number
  totalCount?: number
}

export function createDataTable(app?: App | null) {
  const tableSchema: Schema<DataTableState> = {
    type: 'div',
    props: { class: 'data-table-demo', style: 'padding: 24px;' },
    children: [
      { type: 'h2', props: { style: 'margin-bottom: 24px;' }, children: '产品管理' },

      // 工具栏
      {
        type: 'ElCard',
        props: { shadow: 'never', style: 'margin-bottom: 20px;' },
        children: [
          {
            type: 'div',
            props: { style: 'display: flex; gap: 12px; align-items: center; flex-wrap: wrap;' },
            children: [
              {
                type: 'ElInput',
                model: 'searchKeyword',
                props: { placeholder: '搜索产品名称', clearable: true, style: 'width: 200px;' },
                children: [
                  { type: 'template', slot: 'prefix', children: [{ type: 'ElIcon', children: [{ type: 'Search' }] }] }
                ]
              },
              {
                type: 'ElSelect',
                model: 'selectedCategory',
                props: { placeholder: '所有分类', clearable: true, style: 'width: 150px;' },
                children: [
                  { type: 'ElOption', props: { value: '', label: '所有分类' } },
                  { type: 'ElOption', props: { value: 'electronics', label: '电子产品' } },
                  { type: 'ElOption', props: { value: 'clothing', label: '服装' } },
                  { type: 'ElOption', props: { value: 'food', label: '食品' } }
                ]
              },
              {
                type: 'ElSelect',
                model: 'selectedStatus',
                props: { style: 'width: 120px;' },
                children: [
                  { type: 'ElOption', props: { value: 'all', label: '全部状态' } },
                  { type: 'ElOption', props: { value: 'active', label: '启用' } },
                  { type: 'ElOption', props: { value: 'inactive', label: '禁用' } }
                ]
              },
              {
                type: 'ElButton',
                cond: '{{ selectedIds.length > 0 }}',
                props: { type: 'danger', disabled: '{{ selectedIds.length === 0 }}' },
                events: { click: [{ type: 'call', method: 'batchDelete' }] },
                children: '批量删除 ({{ selectedIds.length }})'
              },
              {
                type: 'ElButton',
                props: { type: 'primary' },
                events: { click: [{ type: 'call', method: 'addProduct' }] },
                children: '添加产品'
              }
            ]
          }
        ]
      },

      // 数据表格
      {
        type: 'ElCard',
        props: { shadow: 'hover' },
        children: [
          {
            type: 'ElTable',
            props: { data: '{{ paginatedProducts }}', style: 'width: 100%;' },
            children: [
              { type: 'ElTableColumn', props: { type: 'selection', width: '55' } },
              { type: 'ElTableColumn', props: { prop: 'name', label: '产品名称', sortable: true, minWidth: '150' } },
              {
                type: 'ElTableColumn',
                props: { prop: 'category', label: '分类', width: '120' },
                children: [
                  {
                    type: 'template',
                    slot: 'default',
                    props: { scope: 'scope' },
                    children: '{{ scope.row.category === "electronics" ? "电子产品" : scope.row.category === "clothing" ? "服装" : scope.row.category === "food" ? "食品" : scope.row.category }}'
                  }
                ]
              },
              {
                type: 'ElTableColumn',
                props: { prop: 'price', label: '价格', sortable: true, width: '120' },
                children: [{ type: 'template', slot: 'default', props: { scope: 'scope' }, children: '¥{{ scope.row.price }}' }]
              },
              { type: 'ElTableColumn', props: { prop: 'stock', label: '库存', width: '100' } },
              {
                type: 'ElTableColumn',
                props: { prop: 'status', label: '状态', width: '100' },
                children: [
                  { type: 'template', slot: 'default', props: { scope: 'scope' }, children: [{ type: 'ElTag', props: { type: '{{ scope.row.status === "active" ? "success" : "info" }}' }, children: '{{ scope.row.status === "active" ? "启用" : "禁用" }}' }] }
                ]
              },
              {
                type: 'ElTableColumn',
                props: { label: '操作', width: '200', fixed: 'right' },
                children: [
                  {
                    type: 'template',
                    slot: 'default',
                    props: { scope: 'scope' },
                    children: [
                      { type: 'ElButton', props: { type: 'primary', size: 'small', link: true }, events: { click: [{ type: 'call', method: 'editProduct', params: { id: '{{ scope.row.id }}' } }] }, children: '编辑' },
                      { type: 'ElButton', props: { type: 'danger', size: 'small', link: true, style: 'margin-left: 8px;' }, events: { click: [{ type: 'call', method: 'deleteProduct', params: { id: '{{ scope.row.id }}' } }] }, children: '删除' }
                    ]
                  }
                ]
              }
            ]
          },

          // 分页
          {
            type: 'div',
            props: { style: 'margin-top: 20px; display: flex; justify-content: space-between; align-items: center;' },
            children: [
              { type: 'div', props: { style: 'color: #909399; font-size: 14px;' }, children: '共 {{ totalCount }} 条记录，第 {{ currentPage }} / {{ totalPages }} 页' },
              {
                type: 'ElPagination',
                props: { currentPage: '{{ currentPage }}', pageSize: '{{ pageSize }}', total: '{{ totalCount }}', pageSizes: [10, 20, 50, 100], layout: 'sizes, prev, pager, next, jumper' },
                events: {
                  'current-change': [{ type: 'set', path: 'currentPage', value: '{{ $event }}' }],
                  'size-change': [
                    { type: 'set', path: 'pageSize', value: '{{ $event }}' },
                    { type: 'set', path: 'currentPage', value: 1 }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  }

  const mockProducts: Product[] = [
    { id: 1, name: 'iPhone 15', category: 'electronics', price: 5999, stock: 50, status: 'active' },
    { id: 2, name: 'MacBook Pro', category: 'electronics', price: 12999, stock: 30, status: 'active' },
    { id: 3, name: 'T-Shirt', category: 'clothing', price: 99, stock: 200, status: 'active' },
    { id: 4, name: 'Coffee', category: 'food', price: 29, stock: 500, status: 'active' },
    { id: 5, name: 'iPad', category: 'electronics', price: 3999, stock: 80, status: 'inactive' },
    { id: 6, name: 'Jeans', category: 'clothing', price: 299, stock: 150, status: 'active' },
    { id: 7, name: 'Bread', category: 'food', price: 15, stock: 300, status: 'active' },
    { id: 8, name: 'Watch', category: 'electronics', price: 1999, stock: 40, status: 'active' }
  ]

  const { vnode, state, ctx } = useVario(tableSchema, {
    app,
    state: {
      products: mockProducts,
      searchKeyword: '',
      selectedCategory: '',
      selectedStatus: 'all',
      sortField: '',
      sortOrder: 'asc',
      currentPage: 1,
      pageSize: 10,
      selectedIds: [],
      selectAll: false
    },
    computed: {
      filteredProducts: (s) => {
        const keyword = (s.searchKeyword || '').toString().toLowerCase()
        return s.products.filter(p => {
          const matchKeyword = !keyword || p.name.toLowerCase().includes(keyword)
          const matchCategory = !s.selectedCategory || p.category === s.selectedCategory
          const matchStatus = s.selectedStatus === 'all' || p.status === s.selectedStatus
          return matchKeyword && matchCategory && matchStatus
        })
      },
      sortedProducts: (s) => {
        if (!s.sortField) return s.filteredProducts
        return [...(s.filteredProducts || [])].sort((a, b) => {
          const aVal = a[s.sortField as keyof Product]
          const bVal = b[s.sortField as keyof Product]
          if (aVal < bVal) return s.sortOrder === 'asc' ? -1 : 1
          if (aVal > bVal) return s.sortOrder === 'asc' ? 1 : -1
          return 0
        })
      },
      paginatedProducts: (s) => {
        const list = s.sortedProducts || []
        const start = (s.currentPage - 1) * s.pageSize
        return list.slice(start, start + s.pageSize)
      },
      totalCount: (s) => (s.filteredProducts || []).length,
      totalPages: (s) => Math.max(1, Math.ceil((s.totalCount || 0) / s.pageSize))
    },
    methods: {
      addProduct: ({ state }: MethodContext<DataTableState>) => {
        const newProduct: Product = {
          id: Date.now(),
          name: `新产品 ${state.products.length + 1}`,
          category: 'electronics',
          price: Math.floor(Math.random() * 10000),
          stock: Math.floor(Math.random() * 200),
          status: 'active'
        }
        state.products.push(newProduct)
      },
      editProduct: ({ params }: MethodContext<DataTableState>) => {
        console.log('Edit product:', params.id)
      },
      deleteProduct: ({ state, params }: MethodContext<DataTableState>) => {
        state.products = state.products.filter(p => p.id !== params.id)
      },
      batchDelete: ({ state }: MethodContext<DataTableState>) => {
        state.products = state.products.filter(p => !state.selectedIds.includes(p.id))
        state.selectedIds = []
      }
    },
    onError: (error: Error) => console.error('[DataTable] Error:', error)
  })

  return { vnode, state, ctx }
}
