<div align="center">

<img src="./play/public/logo-icon.svg" alt="Vario Logo" width="200" style="margin-bottom: -50px; margin-top: -50px;" />

# Vario

> Schema-First UI Behavior Runtime

[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://yuluoy.github.io/vario/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange)](https://pnpm.io/)

[Live Demo](https://yuluoy.github.io/vario/) • [Documentation](https://yuluoy.github.io/vario/docs/) • [Quick Start](https://yuluoy.github.io/vario/docs/guide/quick-start.html) • [Packages](#-packages)

**English** | [中文](./README.zh-CN.md)

</div>

---

Vario is a **Schema-First UI behavior framework**. You describe UI structure, actions, and expressions using JSON Schema; the core runtime executes logic through an Action VM; and the renderer maps the Schema to a concrete framework (currently Vue 3, with other renderers planned).

The goal is to **decouple page structure, interaction logic, and runtime execution** into a stable UI behavior intermediate layer — making it easy to reuse, migrate, and render across frameworks.

## ✨ Features

- **Schema DSL** — Declaratively describe UI structure and interaction logic
- **Action VM** — Unified executor for `call / set / emit / if / loop / batch` instructions
- **Safe Expression Engine** — Whitelist-based sandbox with dependency tracking and expression caching
- **Runtime Context** — Flat state container with `_`-prefixed system APIs and path-based read/write
- **Vue 3 Renderer** — `useVario` composable, two-way binding, event modifiers, refs / teleport / provide / inject
- **Performance Optimizations** — Path memoization, list-item componentization, subtree componentization, SchemaStore

## 🎯 When to Use Vario

Vario is a great fit when you need to decouple "UI behavior definitions" from a specific framework — especially for projects that require reuse, migration, or cross-platform rendering:

- **Low-code / configurable UI** — Schema doubles as a configuration protocol, enabling more efficient front-end and back-end collaboration
- **Cross-framework reuse** — The same Schema can be consumed by different renderers (Vue 3 today, more planned)
- **Complex forms & workflows** — Action VM uniformly handles branching logic, batch actions, and async calls
- **Performance-critical UI** — Path caching, subtree componentization, and list-item componentization optimize large-scale rendering
- **Security-sensitive environments** — The expression engine uses controlled evaluation to prevent arbitrary code execution

## 🧩 Architecture

```
Schema (JSON DSL)
   ↓
Schema Layer  (@variojs/schema — types / validator / normalizer / defineSchema)
   ↓
Core Runtime  (@variojs/core  — RuntimeContext + ExpressionEngine + Action VM)
   ↓
Renderer      (@variojs/vue   — useVario + VNode)
```

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@variojs/core` | Runtime core: Action VM, expression engine, RuntimeContext, schema query utilities |
| `@variojs/schema` | Schema DSL: types, validation, normalization, `defineSchema` |
| `@variojs/types` | Shared type definitions (eliminates cross-package circular dependencies) |
| `@variojs/vue` | Vue 3 renderer and `useVario` composable API |
| `@variojs/cli` | CLI tooling: dev server and code generation (some commands still in progress) |

## 🚀 Quick Start

### Installation

```bash
pnpm add @variojs/vue @variojs/core @variojs/schema
```

### Example (Vue 3)

```ts
import { useVario } from '@variojs/vue'
import type { Schema } from '@variojs/schema'

const schema: Schema = {
  type: 'div',
  children: [
    { type: 'input', model: 'name' },
    {
      type: 'button',
      events: {
        // Array shorthand: ['call', method, params?, modifiers?]
        'click.stop': ['call', 'submit', { params: ['{{ name }}'] }]
      },
      children: 'Submit'
    },
    {
      type: 'div',
      children: 'Hello {{ name }}'
    }
  ]
}

const { vnode, state } = useVario(schema, {
  state: { name: '' },
  methods: {
    submit: ({ params }) => {
      console.log('submitted:', params)
    }
  }
})
```

## 🧠 Core Concepts

- **Schema** — Describes UI structure, events, and behavior; supports expression interpolation (`{{ expr }}`)
- **Action** — A VM execution unit: `call` invokes a method, `set` updates state, `if` / `loop` for control flow, etc.
- **Expression** — A controlled expression engine with dependency tracking and result caching
- **RuntimeContext** — Flat state container exposing `_get` / `_set` / `$emit` and registered methods

## ❓ FAQ

**How is Schema different from writing components directly?**  
Schema is more like an "intermediate representation of UI behavior." It emphasizes declarative descriptions of structure and logic, making them easy to serialize, reuse, migrate, and configure in low-code tools.

**What does the Action VM do?**  
The Action VM executes action sequences and uniformly handles `call / set / emit / if / loop / batch` instructions. It wraps errors and provides timeout protection.

**Are expressions safe?**  
Yes. Expressions use a whitelist mechanism and controlled evaluation to prevent arbitrary code execution. They also benefit from dependency tracking and result caching.

**Is Vue the only supported renderer?**  
Currently, only the Vue 3 renderer is provided. The core runtime and Schema layer are framework-agnostic, so additional renderers can be added in the future.

**What can the CLI do right now?**  
The CLI has a basic dev server and code generation entry point, but some commands are still being refined.

## 📖 Documentation

- [`docs/`](./docs/) — Project guides and API reference
- [`packages/vario-core/README.md`](./packages/vario-core/README.md) — Core runtime
- [`packages/vario-schema/README.md`](./packages/vario-schema/README.md) — Schema DSL
- [`packages/vario-vue/README.md`](./packages/vario-vue/README.md) — Vue renderer
- [`packages/vario-types/README.md`](./packages/vario-types/README.md) — Type definitions
- [`packages/vario-cli/README.md`](./packages/vario-cli/README.md) — CLI tooling

## 🛠️ Development

```bash
pnpm install       # Install dependencies
pnpm build         # Build all packages (two-pass: JS then DTS)
pnpm build:clean   # Clean dist/ then build
pnpm test          # Run all unit tests
pnpm start         # Build packages, then start play (:5173) + docs (:5174)
pnpm dev           # Start without rebuilding (packages must already be built)
```

Single-package workflow:

```bash
pnpm --filter @variojs/core build
pnpm --filter @variojs/core test:watch
```

## 🤝 Contributing

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening an issue or pull request.

## 📄 License

[MIT](./LICENSE)
