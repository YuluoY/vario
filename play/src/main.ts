import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import i18n from './locales'
import '@src/styles/global.scss'

const app = createApp(App)

// 注册全局组件图标（通过 app.component() 注册，Vario 会自动解析）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 全局错误处理：捕获组件 directive 的错误
app.config.errorHandler = (err, _instance, info) => {
  // 忽略某些 directive 的 binding undefined 错误（常见于第三方组件库）
  if (err instanceof TypeError && err.message?.includes("Cannot read properties of undefined (reading 'arg')")) {
    console.warn('[Vue] Directive binding error (ignored):', err.message)
    return
  }
  // 其他错误正常处理
  console.error('[Vue] Error:', err, info)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(i18n)

app.mount('#app')
