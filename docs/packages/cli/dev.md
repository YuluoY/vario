# vario dev 开发服务器

启动带 HMR 的开发服务器，监听 `.vario.ts` 等文件变化并自动重新编译与刷新。

## 用法

```bash
vario dev [options]
```

## 选项

| 选项 | 简写 | 默认 | 说明 |
|------|------|------|------|
| --port \<port\> | -p | 3000 | 端口 |
| --host \<host\> | -h | localhost | 主机（0.0.0.0 可局域网访问） |
| --open | — | false | 启动后自动打开浏览器 |

## 示例

```bash
# 默认 3000 端口
vario dev

# 指定端口与主机
vario dev -p 8080 -h 0.0.0.0

# 启动并打开浏览器
vario dev --open
```

## 功能要点

- **热模块替换（HMR）**：修改代码后尽量只更新变更模块，减少整页刷新。
- **文件监听**：监听项目内 `.vario.ts` 等约定文件，变更后触发重新编译。
- **实时预览**：浏览器中实时看到 Schema / 应用效果。

在 monorepo 中可对 play 或 docs 目录在根目录用 `pnpm run dev` 等脚本包装 `vario dev`，或直接进入子包目录再执行。详见 [CLI 最佳实践](/packages/cli/best-practices)。
