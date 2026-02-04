import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,  // CLI 工具不需要压缩，方便调试
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  shims: true,
  external: ['@variojs/core', '@variojs/schema', '@variojs/vue']
})
