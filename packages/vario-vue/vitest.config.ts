import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    tsconfigPaths({
      // 指定要使用的 tsconfig.json 文件
      // 对于 vario-core 的 @/ 别名，会自动从 vario-core/tsconfig.json 读取
      projects: [
        resolve(__dirname, '../vario-core/tsconfig.json'),
        resolve(__dirname, './tsconfig.json')
      ]
    })
  ],
  test: {
    globals: true,
    environment: 'node' // 暂时使用 node 环境，后续可改为 jsdom
  },
  resolve: {
    alias: {
      '@vario/core': resolve(__dirname, '../vario-core/src'),
      '@vario/schema': resolve(__dirname, '../vario-schema/src')
    }
  }
})