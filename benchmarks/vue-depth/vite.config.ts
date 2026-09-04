import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

const repo = resolve(__dirname, '../..')

export default defineConfig({
  root: resolve(__dirname),
  plugins: [vue()],
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@variojs/vue': resolve(repo, 'packages/vario-vue/src/index.ts'),
      '@variojs/core': resolve(repo, 'packages/vario-core/dist/index.js'),
      '@variojs/schema': resolve(repo, 'packages/vario-schema/src/index.ts'),
      '@variojs/types': resolve(repo, 'packages/vario-types/dist/index.js'),
      '@/': resolve(repo, 'packages/vario-core/src/') + '/',
      '@': resolve(repo, 'packages/vario-core/src')
    }
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
  },
  build: {
    outDir: resolve(__dirname, '../../output/vue-depth-bench'),
    emptyOutDir: true,
    minify: true,
    sourcemap: false
  },
  base: './',
  preview: {
    host: '127.0.0.1'
  }
})
