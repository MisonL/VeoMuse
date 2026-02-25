# Specification: 核心业务迁移与 AI 创意引擎

## 1. 业务逻辑迁移
- 将原有的 `VideoService` 迁移至 `apps/backend`，适配 Bun 运行时。
- 将旧的 Express 视频生成路由重构为 Elysia 路由，并导出类型定义。
- 实现基于 WebSockets 的实时进度推送（Elysia WebSocket）。

## 2. AI 创意引擎 (AI Translation Layer)
- 引入 `gemini-2.0-flash` 作为智能翻译层。
- 功能：用户输入简单的创意，AI 自动扩充为专业的分镜描述、光影指令和负面提示词。

## 3. 前端集成
- 在 React 前端使用 Eden Treaty 接管视频生成流程。
- 实现带有 AI 扩充功能的“智能提示词编辑器”。
