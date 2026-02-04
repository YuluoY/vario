import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@src/views/Home.vue')
  },
  {
    path: '/unit-tests',
    name: 'UnitTests',
    component: () => import('@src/views/UnitTests.vue')
  },
  {
    path: '/integration-tests',
    name: 'IntegrationTests',
    component: () => import('@src/views/IntegrationTests.vue')
  },
  {
    path: '/performance-tests',
    name: 'PerformanceTests',
    component: () => import('@src/views/PerformanceTests.vue')
  },
  {
    path: '/examples',
    name: 'Examples',
    component: () => import('@src/views/Examples.vue')
  },
  {
    path: '/test-dashboard',
    name: 'TestDashboard',
    component: () => import('@src/views/TestDashboard.vue')
  },
  {
    path: '/playground',
    name: 'Playground',
    component: () => import('@src/views/Playground.vue')
  },
  {
    path: '/schema-query-demo',
    name: 'SchemaQueryDemo',
    component: () => import('@src/views/SchemaQueryDemo.vue')
  }
]

// 支持 GitHub Pages base 路径
const base = import.meta.env.BASE_URL || '/'

const router = createRouter({
  history: createWebHistory(base),
  routes
})

export default router
