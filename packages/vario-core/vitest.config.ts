import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/test/**']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    },
    // 确保相对路径导入能正确解析（支持 .ts 文件）
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  // 确保 TypeScript 文件正确解析
  esbuild: {
    target: 'node18'
  },
  // 配置 Vite 的依赖优化
  optimizeDeps: {
    include: ['@babel/parser', '@babel/types']
  }
})
