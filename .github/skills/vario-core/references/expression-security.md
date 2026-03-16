# Expression Security — Deep Reference

> 读取时机：需要理解表达式沙箱安全机制、调试被拒绝的表达式、或配置安全选项时读取。

## Table of Contents
1. [多层安全模型](#多层安全模型)
2. [AST 白名单](#ast-白名单)
3. [函数白名单](#函数白名单)
4. [属性黑名单](#属性黑名单)
5. [嵌套深度限制](#嵌套深度限制)
6. [危险模式检测](#危险模式检测)
7. [缓存安全](#缓存安全)

---

## 多层安全模型

表达式沙箱采用纵深防御（Defense in Depth），任一层拒绝即整条表达式不执行：

```
源字符串
  → 第 1 层：AST 解析 + 节点类型白名单 (ALLOWED_NODE_TYPES)
  → 第 2 层：AST 校验 + 危险节点检测 (FORBIDDEN_NODE_TYPES)
  → 第 3 层：属性黑名单 (__proto__, constructor, prototype)
  → 第 4 层：函数白名单 (只允许已注册的安全函数)
  → 第 5 层：运行时限制 (maxSteps, timeout, maxNestingDepth)
  → 安全求值结果
```

## AST 白名单

### ALLOWED_NODE_TYPES（允许的节点类型）

```
Identifier          — 变量名: count, user
MemberExpression    — 属性访问: user.name, items[0]
Literal             — 字面量: 42, "hello", true
BinaryExpression    — 二元运算: a + b, a === b
LogicalExpression   — 逻辑运算: a && b, a || b
UnaryExpression     — 一元运算: !a, -b, typeof x
ConditionalExpression — 三元: a ? b : c
CallExpression      — 函数调用: Math.max(a, b)
ArrayExpression     — 数组字面量: [1, 2, 3]
ObjectExpression    — 对象字面量: { a: 1 }
TemplateLiteral     — 模板字符串: `hello ${name}`
ChainExpression     — 可选链: user?.name
```

### FORBIDDEN_NODE_TYPES（禁止的节点类型）

```
AssignmentExpression    — 赋值: a = 1
UpdateExpression        — 自增/减: a++, --b
FunctionExpression      — 函数创建: function() {}
ArrowFunctionExpression — 箭头函数: () => {}
NewExpression           — new 操作: new Function()
ClassExpression         — 类创建
SequenceExpression      — 逗号表达式: (a, b)
TaggedTemplateExpression
ImportExpression        — 动态导入: import()
YieldExpression
AwaitExpression
```

遇到 FORBIDDEN 节点 → 立即抛出 `ExpressionError`，不继续解析。

---

## 函数白名单

### 全局对象（只允许安全子集）

| 对象 | 允许的方法/属性 |
|------|----------------|
| `Math` | `abs`, `ceil`, `floor`, `round`, `max`, `min`, `pow`, `sqrt`, `random`, `PI`, `E`, `sign`, `trunc`, `log`, `log2`, `log10` |
| `Array` | `isArray`（静态方法唯一允许项） |
| `JSON` | `parse`, `stringify` |
| `String` | `fromCharCode` |
| `Number` | `isNaN`, `isFinite`, `isInteger`, `parseInt`, `parseFloat` |
| `Object` | `keys`, `values`, `entries`, `assign`, `freeze` |
| `Date` | 仅构造器（`new Date()`），不允许实例方法 |

### 数组实例方法（只读/非变异）

```
slice, map, filter, find, findIndex, includes, indexOf,
join, some, every, reduce, reduceRight, flat, flatMap,
concat, toString, at, entries, keys, values
```

**不允许的变异方法**：`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`（这些操作通过 VM 指令执行，不在表达式中）。

### 字符串实例方法

```
charAt, charCodeAt, toLowerCase, toUpperCase, trim, trimStart, trimEnd,
startsWith, endsWith, includes, indexOf, lastIndexOf, slice, substring,
padStart, padEnd, repeat, replace, replaceAll, split, match, search, at
```

---

## 属性黑名单

任何对象的以下属性**始终禁止访问**：

```
__proto__
constructor
prototype
__defineGetter__
__defineSetter__
__lookupGetter__
__lookupSetter__
```

通过属性访问检查实现：`MemberExpression` 的 `property` 如果匹配黑名单 → 抛出 `ExpressionError`。

---

## 嵌套深度限制

- **默认 maxNestingDepth**: 50
- 每进入一层嵌套（括号、函数调用、三元、成员访问链）深度 +1
- 超过限制 → 抛出 `ExpressionError('Maximum nesting depth exceeded')`
- 防止构造 `(((((...)))))`  类 DoS 攻击

---

## 危险模式检测

除了节点类型检查，还有额外的模式匹配：

| 危险模式 | 检测方式 | 拒绝原因 |
|----------|----------|----------|
| `eval(...)` | CallExpression callee 为 Identifier('eval') | 任意代码执行 |
| `Function(...)` | CallExpression callee 为 Identifier('Function') | 函数构造 |
| `setTimeout/setInterval` | CallExpression callee 匹配 | 字符串代码执行 |
| `obj.constructor` | MemberExpression property | 原型链逃逸 |
| `obj['__proto__']` | 计算属性访问黑名单字符串 | 原型链污染 |

---

## 缓存安全

- 每个 RuntimeContext 独立缓存（WeakMap 隔离），上下文被 GC 时缓存自动释放
- 缓存 key 为表达式字符串，不含求值结果 → 表达式结构描述相同即复用编译产物
- 缓存有大小上限（100 条/ctx），LRU 淘汰
- `invalidateCache(pattern)` 支持通配符，精确清除依赖特定路径的缓存
- 全局 path 缓存（2000 条）独立于表达式缓存，溢出时清空重建
