import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * 解析 vario-core 编译后的路径别名
 */
function resolveCoreAliases() {
  return {
    name: 'resolve-core-aliases',
    resolveId(id: string, importer?: string) {
      // 处理 @/ 开头的路径别名
      if (id.startsWith('@/')) {
        // 如果导入来自 vario-core/dist，则映射到 vario-core/dist 目录
        if (importer?.includes('vario-core/dist')) {
          const coreDistPath = resolve(__dirname, './packages/vario-core/dist')
          const relativePath = id.replace('@/', '')
          const resolvedPath = resolve(coreDistPath, relativePath)
          return resolvedPath
        }
        // 如果导入来自 vario-schema/dist，则映射到 vario-schema/dist 目录
        if (importer?.includes('vario-schema/dist')) {
          const schemaDistPath = resolve(__dirname, './packages/vario-schema/dist')
          const relativePath = id.replace('@/', '')
          const resolvedPath = resolve(schemaDistPath, relativePath)
          return resolvedPath
        }
        // 如果导入来自 vario-vue/dist，则映射到 vario-vue/dist 目录
        if (importer?.includes('vario-vue/dist')) {
          const vueDistPath = resolve(__dirname, './packages/vario-vue/dist')
          const relativePath = id.replace('@/', '')
          const resolvedPath = resolve(vueDistPath, relativePath)
          return resolvedPath
        }
        // 如果导入来自 vario-cli/dist，则映射到 vario-cli/dist 目录
        if (importer?.includes('vario-cli/dist')) {
          const cliDistPath = resolve(__dirname, './packages/vario-cli/dist')
          const relativePath = id.replace('@/', '')
          const resolvedPath = resolve(cliDistPath, relativePath)
          return resolvedPath
        }
        // 默认映射到 vario-core/dist 目录
        const coreDistPath = resolve(__dirname, './packages/vario-core/dist')
        const relativePath = id.replace('@/', '')
        const resolvedPath = resolve(coreDistPath, relativePath)
        return resolvedPath
      }
      return null
    }
  }
}

export default defineConfig({
  plugins: [
    resolveCoreAliases(),
    tsconfigPaths({
      projects: [
        resolve(__dirname, './tsconfig.base.json'),
        resolve(__dirname, './packages/vario-core/tsconfig.json'),
        resolve(__dirname, './packages/vario-schema/tsconfig.json'),
        resolve(__dirname, './packages/vario-vue/tsconfig.json'),
        resolve(__dirname, './packages/vario-cli/tsconfig.json'),
        resolve(__dirname, './tests/tsconfig.json'),
      ]
    })
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/test/**']
    }
  },
  resolve: {
    alias: {
      '@vario/core': resolve(__dirname, './packages/vario-core/dist/index.js'),
      '@vario/schema': resolve(__dirname, './packages/vario-schema/dist/index.js'),
      '@vario/vue': resolve(__dirname, './packages/vario-vue/dist/index.js'),
      '@vario/cli': resolve(__dirname, './packages/vario-cli/dist/index.js'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  esbuild: {
    target: 'node18'
  }
})