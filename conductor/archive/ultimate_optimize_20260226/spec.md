# Specification: VeoMuse 旗舰版终极优化与最佳实践对齐

## 1. 概述 (Overview)
本项目将执行全方位的工程化升级，旨在将 VeoMuse 的核心架构、性能表现及 UI/UX 质感推向 2026 年工业级顶尖水平。我们将严格对齐 Bun, Vite 8, React 19 和 Elysia 的官方最佳实践。

## 2. 功能需求 (Functional Requirements)
### 2.1 性能与交互 (Performance & Interaction)
- **React 19 Actions**: 在所有表单和异步操作中引入 `useActionState`，替代传统的 `useState` 加载管理。
- **Optimistic UI**: 利用 `useOptimistic` 实现瞬间交互反馈，消除生成和编辑过程中的心理等待。
- **并发渲染与虚拟化**: 为 120s+ 时间轴引入 React 并发模式和长列表虚拟化，确保高密度剪辑下无掉帧。
- **Vite 8 / Rolldown 优化**: 开启 Oxc 混淆与 Rolldown 深度构建优化，实现极速的生产环境加载。

### 2.2 类型安全 (Type Safety)
- **Shared Type Bridge**: 在 `packages/shared` 中建立统一的类型中转站，彻底隔离前后端源码引用，解决 Monorepo 循环依赖隐患。
- **Eden Treaty 3.0**: 采用官方推荐的最稳健导出模型，实现 100% 强类型 E2E 通讯。

### 2.3 UI/UX 美学重塑 (UI/UX Refinement)
- **Premium Light Mode**: 引入苹果级“极简白 + 旗舰蓝”亮色主题，使用高度透明的毛玻璃效果。
- **Spring Physics**: 全量升级 Framer Motion 动效，使用物理弹性引擎模拟真实物体惯性。

### 2.4 依赖库治理
- **回归最佳实践**: 扫描全量依赖（Zustand, Framer Motion, Elysia 插件等），根据 2026 最新文档重构陈旧实现。

## 3. 验收标准 (Acceptance Criteria)
- 全站 0 类型错误，0 编译警告。
- 生产环境包体积减小 20% 以上。
- LCP < 1.2s，交互响应延迟 < 100ms。
- 亮色/暗色模式切换丝滑，无样式闪烁。
