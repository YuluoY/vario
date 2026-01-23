# Vario 表达式系统

## 概述

Vario 表达式系统是一个安全、强大的表达式求值引擎，支持复杂的条件判断、数据访问和计算。

## 支持的语法

### 1. 基础表达式

```javascript
// 变量访问
showContent
userRole
count

// 字面量
123
"hello"
true
false
null
```

### 2. 成员访问

```javascript
// 对象属性
user.name
user.profile.email

// 数组访问
todos[0]
items[index]

// 可选链（安全访问）
user?.profile?.name
```

### 3. 二元运算

```javascript
// 算术运算
count + 1
price * quantity
total / items.length

// 比较运算
count > 10
userRole === "admin"
age >= 18
name !== ""

// 逻辑运算
showContent && userRole === "admin"
count > 0 || isActive
```

### 4. 逻辑表达式

```javascript
// AND
userRole === "admin" && showContent
count > 10 && items.length > 0

// OR
userRole === "admin" || userRole === "user"
isActive || isEnabled

// 空值合并
name ?? "Guest"
value ?? defaultValue
```

### 5. 三元表达式

```javascript
// 条件表达式
count > 10 ? "high" : "low"
userRole === "admin" ? "Admin" : "User"
showContent ? "visible" : "hidden"
```

### 6. 函数调用（白名单）

```javascript
// 数组方法
Array.isArray(items)
todos.length
items.filter(item => item.active).length

// 数学函数
Math.max(a, b)
Math.min(x, y)
Math.round(value)

// 字符串方法（通过属性访问）
name.length
message.toUpperCase()
```

### 7. 复杂条件示例

```javascript
// 多条件组合
userRole === "admin" && showContent && count > 10

// 嵌套条件
(userRole === "admin" || userRole === "user") && isActive

// 数组操作
todos.length > 0 && todos.filter(t => t.completed).length > 0

// 对象属性检查
user && user.profile && user.profile.email
user?.profile?.email  // 使用可选链更简洁
```

## 在 Schema 中使用

### cond 条件渲染

```json
{
  "type": "ElAlert",
  "cond": "{{ userRole === 'admin' && showContent }}",
  "props": { "type": "success" },
  "children": "Admin content"
}
```

### show 可见性控制

```json
{
  "type": "ElCard",
  "show": "{{ showContent && items.length > 0 }}",
  "children": "Content"
}
```

### props 中的表达式

```json
{
  "type": "ElInput",
  "props": {
    "placeholder": "{{ userRole === 'admin' ? 'Admin input' : 'User input' }}",
    "disabled": "{{ !isActive }}"
  }
}
```

### 循环中的表达式

```json
{
  "type": "div",
  "loop": {
    "items": "{{ todos.filter(t => !t.completed) }}"
  },
  "children": "{{ $record.text }}"
}
```

## 安全特性

1. **白名单验证**：只允许安全的 AST 节点类型
2. **禁止危险操作**：不允许赋值、函数定义、this 访问等
3. **执行限制**：最大步数和超时限制，防止无限循环
4. **沙箱隔离**：禁止访问全局对象和危险属性

## 性能优化

1. **表达式缓存**：相同表达式的求值结果会被缓存
2. **依赖追踪**：自动追踪表达式依赖的状态路径
3. **缓存失效**：状态更新时自动失效相关缓存

## 限制

1. **不支持赋值**：`a = b` 不允许
2. **不支持函数定义**：`() => {}` 不允许
3. **不支持 this**：`this.value` 不允许
4. **不支持 new**：`new Date()` 不允许（但可以使用 Date.now()）
5. **函数调用受限**：只能调用白名单中的函数

## 最佳实践

1. **使用可选链**：`user?.profile?.name` 比 `user && user.profile && user.profile.name` 更简洁
2. **简化条件**：将复杂条件拆分为多个简单条件
3. **利用缓存**：相同表达式会自动缓存，无需担心性能
4. **类型安全**：表达式结果类型在运行时确定，使用时注意类型检查
