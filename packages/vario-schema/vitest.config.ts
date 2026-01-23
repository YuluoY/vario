import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

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
          const coreDistPath = resolve(__dirname, '../vario-core/dist')
          const relativePath = id.replace('@/', '')
          const resolvedPath = resolve(coreDistPath, relativePath)
          return resolvedPath
        }
        // 否则映射到当前包的 src 目录
        const selfSrcPath = resolve(__dirname, './src')
        const relativePath = id.replace('@/', '')
        const resolvedPath = resolve(selfSrcPath, relativePath)
        return resolvedPath
      }
      return null
    }
  }
}

export default defineConfig({
  plugins: [resolveCoreAliases()],
  test: {
    globals: true,
    environment: 'node'
  }
})
