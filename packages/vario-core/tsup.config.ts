import { defineConfig } from 'tsup'

const shared = {
  format: ['esm'] as const,
  dts: true,
  minify: true,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  splitting: false,
  treeshake: true
}

export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      runtime: 'src/runtime/index.ts',
      expression: 'src/expression/index.ts',
      vm: 'src/vm/index.ts',
      'schema-tools': 'src/schema/index.ts'
    },
    clean: false,
    external: ['@variojs/types', '@variojs/schema', '@babel/parser', '@babel/types']
  },
  {
    ...shared,
    entry: {
      compiler: 'src/expression/parser.ts'
    },
    clean: false,
    external: ['@variojs/types', '@variojs/schema'],
    noExternal: ['@babel/parser', '@babel/types'],
    platform: 'node'
  }
])
