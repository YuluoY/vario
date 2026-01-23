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
