# Vario Playground

A comprehensive testing platform for Vario - UI Behavior IR + Runtime VM. This playground demonstrates Vario's capabilities through unit tests, integration tests, and practical examples.

## Features

### 🎯 Unit Tests
- **Runtime Context**: Test state management, proxy protection, and method registration
- **Expression System**: Evaluate expressions, test caching performance, and validate security
- **Instruction VM**: Execute instructions, test control flow, and handle events
- **Schema**: Define, validate, and render schemas

### 🔗 Integration Tests
- **Todo App**: Complete todo application using Vario Schema with state management, event handling, conditional rendering, and list operations

### 📚 Examples
- Quick start guide
- Schema examples
- Instruction examples
- Expression examples
- Resources and documentation links

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Build Vario packages:
```bash
pnpm build
```

3. Start the development server:
```bash
cd play
pnpm dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
play/
├── src/
│   ├── components/        # Test components
│   │   ├── RuntimeContextTests.vue
│   │   ├── ExpressionTests.vue
│   │   ├── InstructionTests.vue
│   │   └── SchemaTests.vue
│   ├── examples/          # Integration test demos
│   │   └── TodoAppDemo.vue
│   ├── views/             # Page views
│   │   ├── Home.vue
│   │   ├── UnitTests.vue
│   │   ├── IntegrationTests.vue
│   │   └── Examples.vue
│   ├── router/            # Vue Router configuration
│   ├── styles/            # Design system styles
│   ├── App.vue            # Root component
│   └── main.ts            # Entry point
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Design System

The playground follows a comprehensive design system based on web-design-guidelines skill:

### Color System
- Primary colors: Blue (#3B82F6) and Purple (#8B5CF6)
- Semantic colors: Success, Warning, Error
- Neutral colors for text and backgrounds

### Typography
- Font families: Inter, JetBrains Mono for code
- Modular scale: 12px to 48px
- Font weights: 300 to 700

### Spacing
- 8pt grid system
- Consistent spacing scale from 0.25rem to 6rem

### Components
- Buttons: Primary, Secondary, Ghost
- Forms: Inputs, Selects, Checkboxes
- Cards, Modals, Tables
- Loading states and error handling

## Testing Vario Features

### Runtime Context
1. Navigate to **Unit Tests** → **Runtime Context**
2. Test state management by updating values
3. Try overriding protected properties (should fail)
4. Register custom methods and execute them

### Expression System
1. Navigate to **Unit Tests** → **Expression System**
2. Evaluate basic expressions like `user.name + " is " + user.age + " years old"`
3. Update context variables and re-evaluate
4. Run cache performance tests
5. Test security validation

### Instruction VM
1. Navigate to **Unit Tests** → **Instruction VM**
2. Execute instruction sequences in JSON format
3. Try array operations (push, pop, shift, unshift, splice)
4. Emit events and check the event log

### Schema
1. Navigate to **Unit Tests** → **Schema**
2. Define schemas in JSON format
3. Render schemas and see the preview
4. Test conditional rendering and list rendering

### Integration Tests
1. Navigate to **Integration Tests**
2. Choose a demo (Todo App, User Form, Chat, etc.)
3. Interact with the demo to see Vario in action
4. Observe state changes and event handling

## Contributing

This playground is designed to be a testing environment for Vario. Feel free to:
- Add new test cases
- Create additional examples
- Improve the design system
- Report bugs and issues

## License

MIT

## Links

- [Vario Documentation](https://vario.dev/docs)
- [GitHub Repository](https://github.com/vario-project/vario)
- [Design Guidelines](https://vario.dev/design)
