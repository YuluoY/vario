# 🛠️ @variojs/cli

Vario CLI 工具 - 开发服务器、代码生成、构建工具

## 特点

- 🚀 **开发服务器**：热模块替换（HMR），实时预览
- 📝 **代码生成**：从模板生成代码
- ✅ **Schema 验证**：验证 Vario Schema 文件
- 🔧 **构建工具**：生产环境构建

## 安装

```bash
npm install -g @variojs/cli
# 或
pnpm add -g @variojs/cli
```

依赖的 `@variojs/core`、`@variojs/schema`、`@variojs/vue` 会自动安装。

## 快速开始

```bash
# 查看帮助
vario --help

# 启动开发服务器
vario dev

# 验证 Schema
vario validate ./schema.vario.ts
```

## 主要命令

### dev

启动开发服务器：

```bash
vario dev -p 3000 --open
```

### validate

验证 Schema 文件：

```bash
vario validate ./schema.vario.ts
```

### generate

从模板生成代码：

```bash
vario generate -t component --schema ./schema.vario.ts
```

## 优势

- ✅ **开发体验**：HMR、文件监听、自动重新编译
- ✅ **类型安全**：Schema 验证确保正确性
- ✅ **代码生成**：模板化生成，提高效率
- ✅ **易于集成**：支持项目依赖和全局安装

## 许可证

MIT
