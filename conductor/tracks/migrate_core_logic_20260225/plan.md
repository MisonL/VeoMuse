# Implementation Plan: 核心业务迁移与 AI 创意引擎

## Phase 1: 后端重构与服务迁移 [checkpoint: d0ca9cc]
- [x] **Task: 迁移并增强 VideoService** (28bce97)
    - [x] 整合旧的 `VideoService` 到 `apps/backend/src/services`。
    - [x] 引入 `ApiKeyService` 的多 Key 轮询逻辑。
- [x] **Task: 实现 Elysia 视频路由** (b9a6e2a)
    - [x] 创建 `/api/video/generate` 接口。
    - [x] 配置 WebSocket 进度推送频道。
    - [x] **Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)** (Completed)

## Phase 2: AI 翻译层开发 [checkpoint: 09d126c]
- [x] **Task: 集成 Gemini 创意引擎** (09d126c)
    - [x] 开发 `PromptEnhanceService`。
    - [x] 实现“简单指令 -> 电影级分镜”的提示词自动扩充。
- [x] **Task: 暴露 AI 接口** (09d126c)
    - [x] 创建 `/api/ai/enhance-prompt` 接口。
    - [x] **Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)** (Completed)

## Phase 3: 前端控制台对接 [checkpoint: 44b03ed]
- [x] **Task: 实现 React 智能生成面板** (44b03ed)
    - [x] 构建支持 AI 扩充的提示词输入组件。
    - [x] 通过 Eden Treaty 实时监听生成进度并展示。
- [x] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Completed)
