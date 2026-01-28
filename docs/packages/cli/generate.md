# vario generate 代码生成

从模板和可选 Schema 文件生成代码，用于脚手架、页面/组件初始化等。

## 用法

```bash
vario generate [options]
# 或
vario gen [options]
```

## 选项

| 选项 | 简写 | 默认 | 说明 |
|------|------|------|------|
| --template \<name\> | -t | — | 模板名称 |
| --output \<dir\> | -o | ./generated | 输出目录 |
| --schema \<path\> | — | — | Schema 文件路径（.vario.ts 等） |

## 示例

```bash
# 使用模板 + Schema 生成
vario generate -t component --schema ./schema.vario.ts

# 指定输出目录
vario gen -t page -o ./src/pages --schema ./schema.vario.ts
```

## 使用场景

- **组件/页面脚手架**：按模板生成 Vue 组件 + useVario + 占位 Schema。
- **从 Schema 反推**：根据已有 .vario.ts 生成对应目录结构或路由配置。
- **批量生成**：在脚本中多次调用 `vario gen`，配合不同 -t / -o / --schema 生成多份代码。

具体支持的模板名与生成物以 CLI 实现为准；后续会随版本补充更多模板与选项。详见 [CLI 最佳实践](/packages/cli/best-practices)。
