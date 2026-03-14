import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  // 全局忽略
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/coverage/**',
      'pnpm-lock.yaml',
      'play/**',
    ],
  },

  // 基础 JS 规则
  eslint.configs.recommended,

  // TypeScript 严格规则
  ...tseslint.configs.recommended,

  // 项目级覆盖
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // 关闭与项目风格冲突的规则
      '@typescript-eslint/no-explicit-any': 'off',        // Schema 系统大量 any
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-empty-object-type': 'off',   // 允许 {} 类型
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
    },
  },

  // 测试文件宽松规则
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // CLI 和 log handler 允许 console.log
  {
    files: ['packages/vario-cli/src/**', 'packages/vario-core/src/vm/handlers/log.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
