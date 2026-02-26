# Implementation Plan: 全球模型总线

## Phase 1: 后端架构抽象化
- [~] **Task: 定义模型驱动接口**
    - [ ] 创建 `ModelDriver.ts` 接口定义。
    - [ ] 重构 `VideoService` 为 `VideoOrchestrator`。
- [ ] **Task: 实现首批驱动**
    - [ ] 迁移 Gemini Veo 到新驱动模式。
    - [ ] 实现 Sora (Mock) 和 Kling 的接口包装。

## Phase 2: 模型参数与实验室 UI
- [~] **Task: 模型特有参数注入**
    - [ ] 为不同模型配置专属参数（如：Runway 的运动系数）。
- [ ] **Task: 实验室对比视图**
    - [ ] 在前端实现 2x2 或 1x2 的分屏播放器布局。

## Phase 3: 智能模型路由与最终验证
- [~] **Task: 智能路由逻辑**
    - [ ] 利用 Gemini 3.1 自动推荐当前创意最适合哪款模型。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
