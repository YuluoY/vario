# Vario Core 测试说明

## 快速开始

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 生成覆盖率
pnpm test -- --coverage
```

## 测试结构

```
__tests__/
├── runtime/              # RuntimeContext 相关测试
│   └── create-context.test.ts
├── expression/           # 表达式系统测试
│   ├── evaluate.test.ts  # 表达式求值
│   ├── parser.test.ts    # 表达式解析
│   ├── whitelist.test.ts # AST 白名单验证
│   └── cache.test.ts     # 表达式缓存
└── vm/                   # Instruction VM 测试
    ├── executor.test.ts  # 指令执行器
    └── handlers/
        └── call.test.ts  # call 指令处理器
```

## 测试编写要点

### 1. 测试命名
- 使用中文描述测试行为（符合项目规范）
- 格式：`应该 + 行为描述`

### 2. 测试组织
- 使用 `describe` 组织相关测试
- 使用 `beforeEach` 共享测试设置
- 每个测试独立，不依赖其他测试

### 3. 常见测试模式

#### 正常流程测试
```typescript
it('应该执行 set 指令', async () => {
  await execute([{ op: 'set', path: 'count', value: 10 }], ctx)
  expect(ctx.count).toBe(10)
})
```

#### 错误处理测试
```typescript
it('应该在未知指令时抛出错误', async () => {
  await expect(
    execute([{ op: 'unknown' }], ctx)
  ).rejects.toThrow('Unknown op')
})
```

#### 边界条件测试
```typescript
it('应该处理空数组', () => {
  const result = evaluate('items.length', ctx)
  expect(result).toBe(0)
})
```

## 运行特定测试

```bash
# 运行单个文件
pnpm test __tests__/runtime/create-context.test.ts

# 运行匹配的测试
pnpm test -- -t "应该创建基本的运行时上下文"

# 详细输出
pnpm test -- --reporter=verbose
```

## 调试测试

在测试中使用 `console.log` 或断点调试：

```typescript
it('调试测试', () => {
  console.log('调试信息:', ctx)
  debugger  // 在支持的环境中会暂停
  expect(ctx.user).toBeDefined()
})
```

## 注意事项

1. **测试隔离**: 每个测试应该独立运行，不依赖执行顺序
2. **清理状态**: 使用 `beforeEach` 重置状态，避免测试间污染
3. **异步测试**: 使用 `async/await` 处理异步操作
4. **类型安全**: 测试代码也应该遵循 TypeScript 类型检查
