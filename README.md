<div align="center">

<img src="./play/public/logo-icon.svg" alt="Vario Logo" width="200" style="margin-bottom: -50px" />

**UI 行为中间表示（IR）+ 运行时虚拟机（VM）+ 渐进式跨框架抽象层**

[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://yuluoy.github.io/vario/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/YuluoY/vario)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange)](https://pnpm.io/)

[在线演示](https://yuluoy.github.io/vario/) • [文档](#-文档) • [快速开始](#-快速开始) • [GitHub](https://github.com/YuluoY/vario)

</div>

---

Vario 是一个声明式的 UI 行为框架，通过 JSON Schema DSL 将 UI 逻辑与框架实现分离。它提供了框架无关的核心运行时，支持 Vue、React 等前端框架，并内置了安全沙箱和性能优化。

## 🎯 为什么选择 Vario？

- **声明式编程**：用 JSON Schema 描述 UI 行为，代码更清晰、更易维护
- **框架无关**：核心运行时独立于具体框架，一次定义，多端运行
- **类型安全**：完整的 TypeScript 支持，编译时类型检查
- **安全可靠**：内置沙箱机制，防止恶意代码执行
- **高性能**：表达式缓存、对象池等优化策略，确保运行时性能
- **渐进式集成**：可以逐步迁移现有项目，无需重写

## ✨ 核心特性

- **Schema-First 设计**：使用 JSON Schema DSL 定义 UI 行为，代码即文档
- **框架无关运行时**：核心 VM 独立于 Vue/React，可适配多种框架
- **安全沙箱**：多层防护机制，表达式和方法执行都有安全边界
- **性能优化**：表达式缓存、对象池、路径记忆化等优化策略
- **类型安全**：完整的 TypeScript 类型定义，提供良好的开发体验
- **渐进式集成**：可以逐步迁移现有项目，无需重写

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Rendering Backends                                 │
│ ├─ Vue Renderer (Schema → VNode)                           │
│ └─ React Renderer (Schema → ReactElement) [规划中]        │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Schema Layer                                      │
│ ├─ Schema Types (类型定义)                                 │
│ ├─ Schema Validator (验证器)                                │
│ └─ Schema Normalizer (规范化)                               │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Core Runtime                                       │
│ ├─ RuntimeContext (运行时上下文)                            │
│ ├─ Expression System (表达式系统)                           │
│ └─ Action VM (指令虚拟机)                                  │
└─────────────────────────────────────────────────────────────┘
```

## 📦 包结构

本项目采用 monorepo 架构，使用 pnpm workspace 管理：

### 核心包

- **`@variojs/core`** `v0.0.2` - 核心运行时
  - RuntimeContext：运行时上下文管理
  - Expression System：表达式解析、编译、求值
  - Action VM：指令虚拟机，执行各种操作指令
  - 安全沙箱：多层防护机制
  - 性能优化：表达式缓存、对象池等
  - **依赖**: `@babel/parser`, `@babel/types`

- **`@variojs/schema`** `v0.0.2` - Schema 层
  - Schema 类型定义：完整的 TypeScript 类型
  - Schema Validator：运行时验证
  - Schema Normalizer：规范化工具
  - Schema Transform：转换工具
  - **依赖**: `@variojs/core`

- **`@variojs/vue`** `v0.0.2` - Vue 3 渲染后端
  - 深度集成 Composition API
  - 支持 Vue 3 所有特性（Teleport、Provide/Inject、Refs 等）
  - 双向绑定支持
  - 生命周期钩子
  - **依赖**: `@variojs/core`, `@variojs/schema`, `vue ^3.4.0`

- **`@variojs/cli`** `v0.0.2` - 命令行工具（开发中）
  - 代码生成
  - 开发服务器

### 演示平台

- **`play`** - 在线演示和测试平台
  - 单元测试展示
  - 集成测试示例
  - 性能测试工具
  - 代码编辑器（Monaco Editor）
  - 实时预览
  - **主要依赖**: 
    - `vue ^3.4.21`
    - `vue-router ^4.3.0`
    - `vue-i18n ^11.2.8`
    - `element-plus ^2.6.0`
    - `monaco-editor ^0.55.1`
    - `echarts ^5.4.3`
    - `pinia ^2.1.7`

### 开发依赖

- **TypeScript**: `^5.3.3`
- **Vitest**: `^1.2.0` - 测试框架
- **Vite**: `^5.1.6` - 构建工具（play 平台）
- **tsc-alias**: `^1.8.16` - TypeScript 路径别名处理

## 📋 版本信息

- **当前版本**: `0.1.0`
- **Node.js**: `>=18.0.0`
- **pnpm**: `>=8.0.0`
- **TypeScript**: `^5.3.3`

### 包版本

| 包名 | 版本 | 说明 |
|------|------|------|
| `@variojs/core` | `0.0.2` | 核心运行时 |
| `@variojs/schema` | `0.0.2` | Schema 层 |
| `@variojs/vue` | `0.0.2` | Vue 3 渲染后端 |
| `@variojs/cli` | `0.0.2` | CLI 工具（开发中） |

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装

```bash
# 克隆仓库
git clone https://github.com/YuluoY/vario.git
cd vario

# 安装依赖
pnpm install

# 构建所有包
pnpm build
```

### 安装依赖包

如果你想在自己的项目中使用 Vario，可以通过以下方式安装：

```bash
# 安装核心包
pnpm add @variojs/core @variojs/schema @variojs/vue

# 或使用 npm
npm install @variojs/core @variojs/schema @variojs/vue

# 或使用 yarn
yarn add @variojs/core @variojs/schema @variojs/vue
```

### 使用示例

```typescript
import { useVario } from '@variojs/vue'
import type { VueSchemaNode } from '@variojs/vue'

const schema: VueSchemaNode = {
  type: 'div',
  children: [
    {
      type: 'input',
      model: 'name',
      props: { placeholder: '请输入姓名' }
    },
    {
      type: 'div',
      children: '你好，{{ name }}！'
    },
    {
      type: 'button',
      events: {
        click: {
          type: 'call',
          method: 'greet'
        }
      },
      children: '打招呼'
    }
  ]
}

export default {
  setup() {
    const { vnode, state, methods } = useVario(schema, {
      state: {
        name: ''
      },
      methods: {
        greet: ({ state }) => {
          alert(`你好，${state.name}！`)
        }
      }
    })
    
    return { vnode, state }
  }
}
```

## 🌐 在线演示

访问 [GitHub Pages](https://yuluoy.github.io/vario/) 查看完整的演示和测试平台。

演示包括：
- ✅ 单元测试：Runtime Context、Expression System、Instruction VM、Schema
- ✅ 集成测试：完整的 Todo 应用示例
- ✅ 性能测试：大规模渲染性能测试
- ✅ 示例集合：计算器、购物车、数据表格等

## 📖 文档

- [架构设计](./docs/vario-implementation.md) - 完整的技术实现指南
- [开发任务清单](./docs/DEVELOPMENT_TASKS.md) - 当前开发状态和任务
- [Vue 集成文档](./packages/vario-vue/README.md) - Vue 3 集成详细说明（注意：包名为 `@variojs/vue`）
- [表达式系统](./packages/vario-core/src/expression/README.md) - 表达式语法和特性

## 🛠️ 开发指南

### 本地开发

```bash
# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 运行集成测试
pnpm test:integration

# 构建所有包
pnpm build
```

### Play 演示平台

```bash
cd play
pnpm dev
# 访问 http://localhost:5173
```

### 项目结构

```
vario/
├── packages/
│   ├── vario-core/      # 核心运行时 (@variojs/core)
│   ├── vario-schema/    # Schema 层 (@variojs/schema)
│   ├── vario-vue/       # Vue 渲染后端 (@variojs/vue)
│   └── vario-cli/       # CLI 工具 (@variojs/cli)
├── play/                # 演示平台
├── tests/               # 集成测试
└── docs/                # 文档
```

## 🚢 部署

### GitHub Pages 自动部署

项目已配置 GitHub Actions 自动部署到 GitHub Pages：

1. 推送代码到 `main` 分支
2. GitHub Actions 会自动构建并部署
3. 访问 https://yuluoy.github.io/vario/

**手动部署步骤**：

1. 在 GitHub 仓库设置中启用 Pages：
   - Settings → Pages → Source 选择 "GitHub Actions"

2. 构建并推送：
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

3. 等待 GitHub Actions 完成部署

### 本地构建

```bash
# 构建所有包
pnpm build

# 构建 play 站点
cd play
pnpm build

# 预览构建结果
pnpm preview
```

## 🎯 核心概念

### Schema 结构

```typescript
interface VarioSchema {
  state: Record<string, any>          // 初始状态（扁平结构）
  computed?: Record<string, string>   // 计算属性（表达式）
  methods?: Record<string, Action[]>  // 命名方法序列
  onEmit?: Record<string, Action[]>   // 事件处理器
  modelBindings?: string[]            // 双向绑定路径
  render: RenderSchema                // 组件树
}
```

### 表达式系统

支持安全的表达式求值，使用 `{{ }}` 语法：

```typescript
{
  type: 'div',
  children: '{{ user.name + " is " + user.age + " years old" }}',
  show: '{{ count > 10 }}'
}
```

### 指令系统

使用 `$` 前缀标识系统指令：

```typescript
{
  type: 'call',
  method: 'handleClick'
}
```

## 🔒 安全特性

- **表达式沙箱**：严格的白名单机制，禁止访问危险 API
- **路径保护**：防止覆盖系统属性和方法
- **超时控制**：指令执行超时保护
- **类型验证**：Schema 验证确保数据结构正确

## ⚡ 性能优化

- **表达式缓存**：三级缓存机制（编译缓存、依赖缓存、结果缓存）
- **对象池**：循环上下文对象复用
- **路径记忆化**：路径解析结果缓存
- **批量更新**：状态变化批量处理

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔗 相关链接

- [GitHub 仓库](https://github.com/YuluoY/vario)
- [在线演示](https://yuluoy.github.io/vario/)
- [问题反馈](https://github.com/YuluoY/vario/issues)

---

**Vario** - 让 UI 行为定义更简单、更安全、更高效 🚀
