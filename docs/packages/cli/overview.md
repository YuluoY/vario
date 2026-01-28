# @vario/cli 概述

**@vario/cli** 是 Vario 的命令行工具，提供开发服务器、代码生成等，便于本地开发、脚手架与流水线集成。

## 安装

### 全局使用

```bash
npm install -g @variojs/cli
# 或
pnpm add -g @variojs/cli
```

安装后使用 **vario** 命令。

### 项目内使用

```bash
pnpm add -D @variojs/cli
```

在 `package.json` 的 scripts 里调用 `vario` 或 `pnpm exec vario`。

## 命令速览

| 命令 | 说明 |
|------|------|
| **vario dev** | 启动开发服务器，支持 HMR、监听 .vario.ts 等 |
| **vario generate / gen** | 从模板生成代码，可指定 schema 文件与输出目录 |
| **vario build** | 构建生产包（当前为占位，规划中） |
| **vario validate** | 校验 Schema 文件（当前为占位，规划中） |

## 文档导航

- [dev 开发服务器](/packages/cli/dev)：端口、主机、--open、与 Play 的配合
- [generate 代码生成](/packages/cli/generate)：模板、--schema、--output
- [最佳实践](/packages/cli/best-practices)：在 monorepo、CI 中的用法建议

从 [dev](/packages/cli/dev) 开始即可在本地跑起 Vario 应用或 Play。
