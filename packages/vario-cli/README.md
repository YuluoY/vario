# @variojs/cli

Vario CLI Tools - 开发服务器、代码生成、构建工具

## 简介

`@variojs/cli` 是 Vario 项目的命令行工具，提供开发、构建和代码生成等功能。

## 安装

### 全局安装

```bash
npm install -g @variojs/cli
# 或
pnpm add -g @variojs/cli
```

### 项目依赖

```bash
npm install @variojs/cli
# 或
pnpm add @variojs/cli
```

## 快速开始

安装后，可以使用 `vario` 命令：

```bash
vario --help
```

## 命令参考

### dev

启动开发服务器，支持热模块替换（HMR）。

```bash
vario dev [options]
```

**选项**：

- `-p, --port <port>`: 端口号（默认: 3000）
- `-h, --host <host>`: 主机地址（默认: localhost）
- `--open`: 自动打开浏览器

**示例**：

```bash
# 使用默认配置启动
vario dev

# 指定端口和主机
vario dev -p 8080 -h 0.0.0.0

# 自动打开浏览器
vario dev --open
```

**功能**：

- 热模块替换（HMR）
- 文件监听（`.vario.ts` 文件）
- 自动重新编译
- 实时预览

### generate (gen)

从模板生成代码。

```bash
vario generate [options]
# 或
vario gen [options]
```

**选项**：

- `-t, --template <template>`: 模板名称
- `-o, --output <output>`: 输出目录（默认: ./generated）
- `--schema <schema>`: Schema 文件路径

**示例**：

```bash
# 使用模板生成代码
vario generate -t component --schema ./schema.vario.ts

# 指定输出目录
vario gen -t page -o ./src/pages --schema ./schema.vario.ts
```

### build

构建 Vario 项目用于生产环境。

```bash
vario build [options]
```

**选项**：

- `-o, --output <output>`: 输出目录（默认: ./dist）
- `--minify`: 压缩输出（默认: true）

**示例**：

```bash
# 构建项目
vario build

# 指定输出目录
vario build -o ./build

# 禁用压缩
vario build --no-minify
```

**注意**：此命令目前正在开发中。

### validate

验证 Vario Schema 文件。

```bash
vario validate <files...> [options]
```

**参数**：

- `<files...>`: 要验证的 Schema 文件（一个或多个）

**选项**：

- `--strict`: 启用严格验证模式

**示例**：

```bash
# 验证单个文件
vario validate ./schema.vario.ts

# 验证多个文件
vario validate ./schema1.vario.ts ./schema2.vario.ts

# 启用严格模式
vario validate --strict ./schema.vario.ts
```

**注意**：此命令目前正在开发中。

## 配置文件

CLI 工具支持通过配置文件自定义行为（规划中）：

```json
{
  "dev": {
    "port": 3000,
    "host": "localhost",
    "open": true
  },
  "build": {
    "output": "./dist",
    "minify": true
  }
}
```

## 开发

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/YuluoY/vario.git
cd vario

# 安装依赖
pnpm install

# 构建 CLI
cd packages/vario-cli
pnpm build

# 链接到全局（用于测试）
pnpm link -g
```

### 运行测试

```bash
cd packages/vario-cli
pnpm test
```

## 依赖

- `@variojs/core`: 核心运行时
- `@variojs/schema`: Schema DSL
- `@variojs/vue`: Vue 渲染器
- `commander`: 命令行解析

## 许可证

MIT
