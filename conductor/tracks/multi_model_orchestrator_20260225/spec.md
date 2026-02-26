# Specification: 全球模型总线计划

## 目标
将 VeoMuse 从一个单一模型的应用演进为一个全能的 AI 视频创作中枢（Aggregator）。

## 关键技术栈
- **适配器模式 (Adapter Pattern)**: 后端定义 `VideoModelDriver` 接口，隔离不同厂商的 API 差异。
- **并发任务管理**: 优化 Redis/内存队列，支持多模型同时生成。
- **分屏预览**: 前端 React 实现多播放器同步对比布局。

## 预期产出
- 模型选择器支持：Gemini Veo, Sora (Preview), Kling, Runway Gen-3。
- 后端逻辑统一化：同一套逻辑处理不同模型的 Webhook 和 Polling。
- 前端新增“对比模式”。
