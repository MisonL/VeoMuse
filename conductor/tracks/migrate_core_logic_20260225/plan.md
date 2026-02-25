# Implementation Plan: 核心业务迁移与 AI 创意引擎

## Phase 1: 后端重构与服务迁移
- [x] **Task: 迁移并增强 VideoService** (28bce97)
    - [x] 整合旧的 `VideoService` 到 `apps/backend/src/services`。
    - [x] 引入 `ApiKeyService` 的多 Key 轮询逻辑。
- [ ] **Task: 实现 Elysia 视频路由**
    - [ ] 创建 `/api/video/generate` 接口。
    - [ ] 配置 WebSocket 进度推送频道。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)**

## Phase 2: AI 翻译层开发
- [ ] **Task: 集成 Gemini 创意引擎**
    - [ ] 开发 `PromptEnhanceService`。
    - [ ] 实现“简单指令 -> 电影级分镜”的提示词自动扩充。
- [ ] **Task: 暴露 AI 接口**
    - [ ] 创建 `/api/ai/enhance-prompt` 接口。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)**

## Phase 3: 前端控制台对接
- [ ] **Task: 实现 React 智能生成面板**
    - [ ] 构建支持 AI 扩充的提示词输入组件。
    - [ ] 通过 Eden Treaty 实时监听生成进度并展示。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
