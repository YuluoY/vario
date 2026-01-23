import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// GitHub Pages 部署时使用仓库名作为 base 路径
// 如果环境变量 GITHUB_REPOSITORY 存在，使用仓库名；否则使用 '/'
const getBasePath = () => {
  // 支持 GitHub Actions 环境变量
  const repo = process.env.GITHUB_REPOSITORY || process.env.VITE_GITHUB_REPOSITORY
  if (repo) {
    const repoName = repo.split('/')[1]
    return `/${repoName}/`
  }
  // 本地开发或自定义部署时使用 '/'
  return process.env.BASE_PATH || process.env.VITE_BASE_PATH || '/'
}

export default defineConfig({
  base: getBasePath(),
  plugins: [vue()],
  resolve: {
    alias: {
      // 为 vario-core 编译后的 dist 文件添加别名解析（使用 @/ 导入）
      // Vite 使用最长匹配原则，更具体的别名应放在前面
      '@/expression': path.resolve(__dirname, '../packages/vario-core/dist/expression'),
      '@/vm': path.resolve(__dirname, '../packages/vario-core/dist/vm'),
      '@/runtime': path.resolve(__dirname, '../packages/vario-core/dist/runtime'),
      '@/types': path.resolve(__dirname, '../packages/vario-core/dist/types'),
      // 通用的 @/ 别名（优先级最低，放在最后）
      '@/': path.resolve(__dirname, '../packages/vario-core/dist/'),
      // src 目录的别名（使用不同的前缀避免冲突）
      '@src': path.resolve(__dirname, './src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@src/styles/design-tokens" as *;`
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vue 核心库单独打包（必须在最前面）
          if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) {
            return 'vue-core'
          }
          // Vue 生态系统库（router, pinia, i18n）
          if (id.includes('vue-router') || id.includes('pinia') || id.includes('vue-i18n')) {
            return 'vue-vendor'
          }
          // Element Plus 单独打包（依赖 Vue，必须在 Vue 之后）
          if (id.includes('element-plus')) {
            return 'element-plus'
          }
          // ECharts 单独打包
          if (id.includes('echarts')) {
            return 'echarts'
          }
          // Monaco Editor 单独打包
          if (id.includes('monaco-editor')) {
            return 'monaco-editor'
          }
          // 其他 node_modules 中的库
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    },
    // 优化依赖预构建
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'vue-i18n',
      'element-plus',
      '@element-plus/icons-vue'
    ],
    exclude: ['monaco-editor']
  }
})
