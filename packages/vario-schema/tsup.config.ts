import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    codec: 'src/codec/index.ts',
    compiler: 'src/compiler/index.ts'
  },
  format: ['esm'],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  external: ['@variojs/types', '@variojs/core']
})
