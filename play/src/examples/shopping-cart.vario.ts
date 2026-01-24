/**
 * 购物车应用示例 - 使用 vario-vue Composition API
 */

import { useVario, type MethodContext } from '@variojs/vue'
import type { Schema } from '@variojs/schema'
import type { App } from 'vue'

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  image?: string
}

interface ShoppingCartState extends Record<string, unknown> {
  products: Array<{ id: number; name: string; price: number; stock: number; image?: string }>
  cart: CartItem[]
  showCart: boolean
  selectedCategory: string
  totalPrice?: number
  totalItems?: number
  cartEmpty?: boolean
}

export function createShoppingCart(app?: App | null) {
  const cartSchema: Schema<ShoppingCartState> = {
    type: 'div',
    props: { class: 'shopping-cart-demo', style: 'padding: 24px;' },
    children: [
      // 标题栏
      {
        type: 'div',
        props: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;' },
        children: [
          { type: 'h2', children: '商品商城' },
          {
            type: 'ElBadge',
            props: { value: '{{ totalItems }}', hidden: '{{ cartEmpty }}' },
            children: [
              {
                type: 'ElButton',
                props: { type: 'primary', icon: 'ShoppingCart' },
                events: { click: [{ type: 'set', path: 'showCart', value: '{{ !showCart }}' }] },
                children: '购物车'
              }
            ]
          }
        ]
      },

      // 商品列表
      {
        type: 'div',
        cond: '{{ !showCart }}',
        children: [
          {
            type: 'ElRow',
            props: { gutter: 20 },
            children: [
              {
                type: 'ElCol',
                loop: { items: '{{ products }}', itemKey: 'product' },
                props: { span: 6, style: 'margin-bottom: 20px;' },
                children: [
                  {
                    type: 'ElCard',
                    props: { shadow: 'hover', style: 'height: 100%;' },
                    children: [
                      { type: 'div', props: { style: 'text-align: center; margin-bottom: 12px;' }, children: '{{ product.name }}' },
                      { type: 'div', props: { style: 'text-align: center; color: #f56c6c; font-size: 20px; font-weight: bold; margin-bottom: 12px;' }, children: '¥{{ product.price }}' },
                      { type: 'div', props: { style: 'text-align: center; color: #909399; font-size: 12px; margin-bottom: 12px;' }, children: '库存：{{ product.stock }}' },
                      {
                        type: 'ElButton',
                        props: { type: 'primary', style: 'width: 100%;', disabled: '{{ product.stock === 0 }}' },
                        events: { click: [{ type: 'call', method: 'addToCart', params: { productId: '{{ product.id }}' } }] },
                        children: '{{ product.stock === 0 ? "缺货" : "加入购物车" }}'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },

      // 购物车
      {
        type: 'div',
        cond: '{{ showCart }}',
        children: [
          {
            type: 'ElCard',
            props: { shadow: 'hover' },
            children: [
              {
                type: 'div',
                props: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;' },
                children: [
                  { type: 'h3', children: '购物车' },
                  {
                    type: 'ElButton',
                    props: { type: 'text', icon: 'Close' },
                    events: { click: [{ type: 'set', path: 'showCart', value: false }] }
                  }
                ]
              },

              { type: 'div', cond: '{{ cartEmpty }}', props: { style: 'text-align: center; padding: 40px; color: #909399;' }, children: [
                { type: 'ElIcon', props: { size: '48px', style: 'margin-bottom: 12px;' }, children: [{ type: 'ShoppingCart' }] },
                { type: 'div', children: '购物车是空的' }
              ] },

              {
                type: 'div',
                cond: '{{ !cartEmpty }}',
                children: [
                  {
                    type: 'div',
                    loop: { items: '{{ cart }}', itemKey: 'item' },
                    props: { style: 'display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #ebeef5;' },
                    children: [
                      { type: 'div', props: { style: 'flex: 1;' }, children: '{{ item.name }}' },
                      { type: 'div', props: { style: 'width: 100px; text-align: center; color: #f56c6c; font-weight: bold;' }, children: '¥{{ item.price }}' },
                      {
                        type: 'div',
                        props: { style: 'display: flex; align-items: center; gap: 8px; width: 120px; justify-content: center;' },
                        children: [
                          { type: 'ElButton', props: { size: 'small', icon: 'Minus', circle: true }, events: { click: [{ type: 'call', method: 'decreaseQuantity', params: { itemId: '{{ item.id }}' } }] } },
                          { type: 'span', props: { style: 'min-width: 30px; text-align: center;' }, children: '{{ item.quantity }}' },
                          { type: 'ElButton', props: { size: 'small', icon: 'Plus', circle: true }, events: { click: [{ type: 'call', method: 'increaseQuantity', params: { itemId: '{{ item.id }}' } }] } }
                        ]
                      },
                      { type: 'div', props: { style: 'width: 80px; text-align: right; color: #f56c6c; font-weight: bold;' }, children: '¥{{ item.price * item.quantity }}' },
                      { type: 'ElButton', props: { type: 'danger', size: 'small', icon: 'Delete', text: true }, events: { click: [{ type: 'call', method: 'removeFromCart', params: { itemId: '{{ item.id }}' } }] } }
                    ]
                  },

                  { type: 'div', props: { style: 'margin-top: 20px; padding-top: 20px; border-top: 2px solid #ebeef5; display: flex; justify-content: space-between; align-items: center;' }, children: [
                    { type: 'div', props: { style: 'font-size: 18px; font-weight: bold;' }, children: '总计：' },
                    { type: 'div', props: { style: 'font-size: 24px; color: #f56c6c; font-weight: bold;' }, children: '¥{{ totalPrice }}' }
                  ] },

                  { type: 'ElButton', props: { type: 'primary', style: 'width: 100%; margin-top: 20px;', size: 'large' }, events: { click: [{ type: 'call', method: 'checkout' }] }, children: '结算 ({{ totalItems }} 件商品)' }
                ]
              }
            ]
          }
        ]
      }
    ]
  }

  const products = [
    { id: 1, name: 'iPhone 15', price: 5999, stock: 10 },
    { id: 2, name: 'MacBook Pro', price: 12999, stock: 5 },
    { id: 3, name: 'AirPods Pro', price: 1899, stock: 20 },
    { id: 4, name: 'iPad', price: 3999, stock: 15 },
    { id: 5, name: 'Apple Watch', price: 2999, stock: 8 },
    { id: 6, name: 'Magic Mouse', price: 599, stock: 30 }
  ]

  const { vnode, state, ctx } = useVario(cartSchema, {
    app,
    state: {
      products,
      cart: [],
      showCart: false,
      selectedCategory: ''
    },
    computed: {
      totalItems: (s) => s.cart.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: (s) => s.cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
      cartEmpty: (s) => s.cart.length === 0
    },
    methods: {
      addToCart: ({ state, params }: MethodContext<ShoppingCartState>) => {
        const product = state.products.find(p => p.id === params.productId)
        if (!product || product.stock === 0) return
        const existing = state.cart.find(i => i.id === params.productId)
        if (existing) {
          if (existing.quantity < product.stock) existing.quantity += 1
        } else {
          state.cart.push({ id: product.id, name: product.name, price: product.price, quantity: 1 })
        }
      },
      increaseQuantity: ({ state, params }: MethodContext<ShoppingCartState>) => {
        const item = state.cart.find(i => i.id === params.itemId)
        const product = state.products.find(p => p.id === params.itemId)
        if (item && product && item.quantity < product.stock) item.quantity += 1
      },
      decreaseQuantity: ({ state, params }: MethodContext<ShoppingCartState>) => {
        const item = state.cart.find(i => i.id === params.itemId)
        if (item && item.quantity > 1) item.quantity -= 1
      },
      removeFromCart: ({ state, params }: MethodContext<ShoppingCartState>) => {
        state.cart = state.cart.filter(i => i.id !== params.itemId)
      },
      checkout: ({ state, ctx }: MethodContext<ShoppingCartState>) => {
        // 扣减库存
        state.cart.forEach((item) => {
          const product = state.products.find(p => p.id === item.id)
          if (product) {
            product.stock = Math.max(0, product.stock - item.quantity)
          }
        })
        // 清空购物车
        ctx._set('cart', [])
        state.showCart = false
      }
    },
    onError: (error: Error) => console.error('[ShoppingCart] Error:', error)
  })

  return { vnode, state, ctx }
}
