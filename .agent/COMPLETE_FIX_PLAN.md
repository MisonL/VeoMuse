# VeoMuse 完整修复计划

## 问题分析

### 🔴 关键问题

从用户截图可以看到批量生成功能存在严重问题：
- 显示 "未定义batch - 30/29/1720"
- 时间格式完全错误 "undefined:undefined"
- 批量任务数据格式不匹配

### 📋 问题清单

#### 1. 后端代码问题
- ❌ `BatchVideoService.js` 调用了不存在的 `VideoService.generateVideoFromImage()` 方法（第279行）
- ❌ `VideoService.js` 缺少 `generateFromImage()` 方法的调用逻辑
- ❌ 批量任务返回的数据结构与前端期望不匹配
- ❌ 批量任务状态字段命名不一致

#### 2. 前端显示问题
- ❌ `batch.js` 使用了错误的字段名（`batch.total` vs `batch.totalJobs`）
- ❌ 日期格式化错误
- ❌ i18n 翻译键缺失
- ❌ API 方法部分在 `api.js` 中缺失

#### 3. 功能缺失
- ⚠️ 批量生成虽然有框架，但实际调用链断裂
- ⚠️ WebSocket 实时进度更新未正确连接
- ⚠️ 错误处理不完善

---

## 修复计划

### 阶段 1: 修复后端核心逻辑 (高优先级)

#### Task 1.1: 修复 VideoService
- [ ] 确认 `generateFromImage` 方法存在
- [ ] 修复 API 调用逻辑
- [ ] 统一方法命名（`generateFromText` vs `generateVideoFromText`）

#### Task 1.2: 修复 BatchVideoService
- [ ] 修正 `VideoService` 方法调用
- [ ] 确保返回数据结构正确
- [ ] 添加详细的错误日志

#### Task 1.3: 统一数据结构
- [ ] 批量任务返回字段：`totalJobs`, `completedJobs`, `failedJobs`
- [ ] 确保前后端字段名一致
- [ ] 添加 TypeScript 类型注释（注释形式）

### 阶段 2: 修复前端显示 (高优先级)

#### Task 2.1: 修复 batch.js
- [ ] 更新字段名：`total` → `totalJobs`, `completed` → `completedJobs`
- [ ] 修复日期格式化
- [ ] 移除 `this.i18n.t()` 调用，统一使用 `this.i18n.get()`

#### Task 2.2: 完善 API 封装
- [ ] 在 `api.js` 中添加 `createBatch()` 方法
- [ ] 添加 `getBatches()` 方法
- [ ] 添加 `getBatchStatus()` 方法
- [ ] 添加 `cancelBatch()` 方法

#### Task 2.3: 补充 i18n 翻译
- [ ] 添加批量生成相关的所有翻译键
- [ ] 补充状态文本翻译
- [ ] 添加错误消息翻译

### 阶段 3: 功能增强 (中优先级)

#### Task 3.1: 实时进度更新
- [ ] 确保 Socket.IO 事件正确触发
- [ ] 前端监听 `batchUpdate` 事件
- [ ] 前端监听 `jobUpdate` 事件

#### Task 3.2: 错误处理
- [ ] 添加详细的错误日志
- [ ] 前端显示具体错误信息
- [ ] 添加重试逻辑

#### Task 3.3: 用户体验优化
- [ ] 添加加载状态动画
- [ ] 优化进度条显示
- [ ] 添加任务详情查看功能

### 阶段 4: 测试验证 (中优先级)

#### Task 4.1: 单元测试
- [ ] 测试 BatchVideoService 创建任务
- [ ] 测试任务状态查询
- [ ] 测试任务取消

#### Task 4.2: 集成测试
- [ ] 测试完整的批量生成流程
- [ ] 测试 WebSocket 通信
- [ ] 测试错误恢复

---

## 实施顺序

### 第一步：修复核心断裂点
1. ✅ 修复 `VideoService.generateFromImage()` 方法引用
2. ✅ 统一 `BatchVideoService` 中的方法调用
3. ✅ 确保数据结构一致性

### 第二步：修复前端显示
4. ✅ 更新 `batch.js` 字段名
5. ✅ 修复日期格式化
6. ✅ 完善 `api.js` 批量相关方法

### 第三步：补充功能
7. ✅ 添加 i18n 翻译
8. ✅ 实现实时更新
9. ✅ 优化错误处理

### 第四步：测试验证
10. ✅ 手动测试批量生成流程
11. ✅ 验证 WebSocket 通信
12. ✅ 编写单元测试

---

## 预计工作量

- **阶段 1**: 1-2 小时
- **阶段 2**: 1 小时
- **阶段 3**: 1-2 小时
- **阶段 4**: 1 小时

**总计**: 4-6 小时

---

## 风险点

1. **API Key 依赖**: 需要有效的 Gemini API Key (付费层)
2. **并发控制**: 批量生成时需要注意 API 速率限制
3. **内存管理**: 批量任务数据全在内存中，需要定期清理
4. **长时间运行**: 批量任务可能需要很长时间，需要考虑服务器重启的情况

---

## 开始实施 ✨

当前状态：**准备开始**

下一步：修复 `VideoService` 和 `BatchVideoService` 的方法调用问题
