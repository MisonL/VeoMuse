# Implementation Plan: VeoMuse 旗舰版终极优化

## Phase 1: 架构地基与类型安全重塑
- [x] **Task: 建立 Shared Type Bridge** (4e14a8b)
    - [x] 在 `packages/shared` 中建立统一类型定义。
    - [x] 移除前端对后端源码的直接引用。
- [x] **Task: 重构 Eden Treaty 集成** (47c40c3)
    - [x] 按照 3.0 最佳实践重构导出模型。
    - [x] 实现强类型 Error 处理机制。
- [ ] **Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)**

## Phase 2: 极致性能与 React 19 最佳实践
- [ ] **Task: 引入 Actions 与 Optimistic UI**
    - [ ] 在生成和编辑流程中应用 `useActionState`。
    - [ ] 实现片段操作的 `useOptimistic` 瞬间反馈。
- [ ] **Task: 时间轴性能增强**
    - [ ] 实现长列表虚拟化渲染。
    - [ ] 引入 React 并发特性优化渲染优先级。
- [ ] **Task: Vite 8 / Rolldown 终极优化配置**
    - [ ] 开启 Oxc 混淆与深度构建优化。
- [ ] **Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)**

## Phase 3: 美学重塑与亮色模式
- [ ] **Task: 实现 Premium 亮色主题**
    - [ ] 设计并实现“极简白 + 旗舰蓝”主题方案。
    - [ ] 实现丝滑的主题切换逻辑。
- [ ] **Task: 全站 Spring Physics 动效升级**
    - [ ] 将 Tween 动画统一重构为物理弹性动效。
- [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**

## Phase 4: 依赖库对齐与最终打磨
- [ ] **Task: 审计并重构第三方库使用**
    - [ ] 针对 Zustand 和 Framer Motion 进行最佳实践对齐。
- [ ] **Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)**
