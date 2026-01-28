# @vario/cli 最佳实践

## 1. 用项目脚本封装命令

在 `package.json` 的 scripts 里统一入口，便于团队与 CI 使用：

```json
{
  "scripts": {
    "dev": "vario dev -p 3000 --open",
    "gen": "vario gen -t component -o ./src/views"
  }
}
```

如需区分多应用，可写 `"dev:play": "vario dev -p 3000 -h 0.0.0.0"`、`"dev:docs": "vitepress dev"` 等。

## 2. 端口与主机

- 本地独自开发用默认 `localhost` 即可。
- 需要在手机或同事机器访问时，用 `-h 0.0.0.0`；端口用 `-p` 避开冲突。
- CI 或 Docker 里跑 dev 时，同样建议 `-h 0.0.0.0` 并固定 `-p`，便于健康检查或暴露端口。

## 3. 代码生成与 Schema 一致

- **gen** 的 `--schema` 尽量指向项目内已校验过的 Schema 文件（或先跑一遍 **vario validate**，待该命令实现后）。
- 生成目标目录（**-o**）与现有工程结构一致，避免生成到无关或已废弃目录。

## 4. 与 monorepo 的配合

- 若 CLI 装在根目录，scripts 里可通过 `pnpm exec vario dev` 或 `pnpm -C packages/play vario dev` 在指定包目录执行。
- 文档站、Play、各自前端可分别用不同 script（如 `dev`、`dev:play`、`dev:docs`），互不干扰。

## 5. 后续 build / validate

- **vario build**、**vario validate** 完善后，建议在 CI 中增加 `vario validate ./src/**/*.vario.ts` 及 `vario build`，在合并前保证 Schema 合法、构建可过。
