import { defineConfig } from 'vitepress'

const repo = process.env.GITHUB_REPOSITORY
// 确保 base 路径正确：GitHub Pages 使用 /repo-name/docs/，本地使用 /docs/
const base = repo ? `/${repo.split('/')[1]}/docs/` : '/docs/'

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: 'Vario',
  description: 'UI 行为中间表示（IR）+ 运行时虚拟机（VM）+ 渐进式跨框架抽象',
  outDir: '../play/public/docs',
  themeConfig: {
    nav: [
      { text: '介绍', link: '/' },
      { text: '快速开始', link: '/guide/quick-start' },
      { text: 'Core', link: '/packages/core/overview' },
      { text: 'Schema', link: '/packages/schema/overview' },
      { text: 'Vue', link: '/packages/vue/overview' },
      { text: 'CLI', link: '/packages/cli/overview' }
    ],
    sidebar: [
      { text: '介绍', link: '/' },
      { text: '快速开始', link: '/guide/quick-start' },
      {
        text: '@vario/core',
        collapsed: true,
        items: [
          { text: '概述', link: '/packages/core/overview' },
          { text: 'RuntimeContext', link: '/packages/core/runtime-context' },
          { text: '表达式系统', link: '/packages/core/expression' },
          { text: 'Action VM', link: '/packages/core/action-vm' },
          { text: '路径与循环上下文', link: '/packages/core/path-and-loop' },
          { text: '安全与性能', link: '/packages/core/security-performance' },
          { text: 'API 参考', link: '/packages/core/api' },
          { text: '最佳实践', link: '/packages/core/best-practices' }
        ]
      },
      {
        text: '@vario/schema',
        collapsed: true,
        items: [
          { text: '概述', link: '/packages/schema/overview' },
          { text: '类型与 Schema 节点', link: '/packages/schema/types' },
          { text: '验证', link: '/packages/schema/validation' },
          { text: '规范化', link: '/packages/schema/normalization' },
          { text: 'defineSchema', link: '/packages/schema/define-schema' },
          { text: 'API 参考', link: '/packages/schema/api' },
          { text: '最佳实践', link: '/packages/schema/best-practices' }
        ]
      },
      {
        text: '@vario/vue',
        collapsed: true,
        items: [
          { text: '概述', link: '/packages/vue/overview' },
          { text: '快速开始', link: '/guide/quick-start' },
          { text: '状态管理', link: '/guide/state' },
          { text: 'Model 与路径', link: '/guide/model-path' },
          { text: '表达式', link: '/guide/expression' },
          { text: 'Vue 特性', link: '/guide/vue-features' },
          { text: 'Computed 与 Watch', link: '/guide/computed-watch' },
          { text: '控制流', link: '/guide/control-flow' },
          { text: '事件处理', link: '/guide/events' },
          { text: '性能优化', link: '/guide/performance' },
          { text: 'API 参考', link: '/api/use-vario' },
          { text: '类型', link: '/api/types' },
          { text: '最佳实践', link: '/packages/vue/best-practices' }
        ]
      },
      {
        text: '@vario/cli',
        collapsed: true,
        items: [
          { text: '概述', link: '/packages/cli/overview' },
          { text: 'dev 开发服务器', link: '/packages/cli/dev' },
          { text: 'generate 代码生成', link: '/packages/cli/generate' },
          { text: '最佳实践', link: '/packages/cli/best-practices' }
        ]
      },
      { text: '示例', link: '/guide/examples' }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/variojs/vario' }],
    footer: { message: 'MIT License', copyright: 'Vario' }
  }
})
