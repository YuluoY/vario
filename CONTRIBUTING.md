# 贡献指南

## 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响代码运行）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关
- `ci`: CI/CD 相关

### Scope 范围（可选）

- `core`: 核心包 (`@vario/core`)
- `schema`: Schema 包 (`@vario/schema`)
- `vue`: Vue 集成包 (`@vario/vue`)
- `cli`: CLI 工具 (`@vario/cli`)
- `play`: 演示平台
- `ci`: CI/CD 配置

### 示例

```bash
# 新功能
git commit -m "feat(vue): add support for teleport component"

# 修复bug
git commit -m "fix(core): correct expression evaluation for nested paths"

# 文档更新
git commit -m "docs: update README with deployment instructions"

# CI/CD
git commit -m "ci: update pnpm version for lockfile compatibility"

# 重构
git commit -m "refactor(core): simplify runtime context creation"
```

### 注意事项

- Subject 使用祈使句，首字母小写，结尾不加句号
- Body 详细描述修改的原因和方式
- 如果修改涉及破坏性变更，在 footer 中添加 `BREAKING CHANGE:`

## 构建系统

### 两轮构建（Two-Phase Build）

由于 `@variojs/core` 和 `@variojs/schema` 存在相互引用（core 提供表达式引擎，schema 使用 core 的 parseExpression/validateAST），构建脚本 [`scripts/build.mjs`](scripts/build.mjs) 采用两轮构建策略：

1. **第一轮：JS 输出** — 按依赖顺序构建所有包的 JS（types → core → schema → vue → cli），此阶段跳过 DTS 生成
2. **第二轮：DTS 生成** — 再次运行 tsup 仅生成 `.d.ts` 类型声明，此时所有 JS 已就位，TypeScript 可正确解析跨包类型

```bash
pnpm build        # 完整两轮构建
pnpm build:clean  # 先清理 dist 再构建
```

> **注意**：如果构建失败且报类型错误，通常需要 `pnpm build:clean` 清除旧的 DTS 缓存。

### 代码质量工具

```bash
pnpm lint          # ESLint 检查（flat config，eslint.config.mjs）
pnpm lint:fix      # 自动修复可修复的问题
pnpm test          # 运行所有包的单元测试
pnpm test:integration  # 集成测试
```

## 版本策略

各包独立版本（independent versioning）：

| 包 | 当前版本 | 说明 |
|---|---|---|
| `@variojs/types` | 0.0.x | 纯类型包，变更频率低 |
| `@variojs/core` | 0.1.x | 核心运行时，功能趋于稳定 |
| `@variojs/schema` | 0.1.x | Schema 验证/规范化 |
| `@variojs/vue` | 0.5.x | Vue 渲染器，迭代最活跃 |
| `@variojs/cli` | 0.1.x | **实验性** — `build`/`validate` 命令尚未实现 |

各包之间使用 `workspace:*` 协议关联，开发时自动链接。发包时由 publish 脚本处理版本号。

> **关于 @variojs/cli**：CLI 包目前处于实验阶段，`dev` 和 `generate` 命令可用，`build` 和 `validate` 尚为占位。请勿在生产环境依赖 CLI 功能。
