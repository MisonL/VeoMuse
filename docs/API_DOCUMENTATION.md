# VeoMuse 旗舰版 API 接口文档 (V3.1 Pro)

## 1. 核心模型总线 (Model Bus)

### POST `/api/video/generate`
向全球 AI 模型集群提交任务。
- **Params**: `modelId` (optional), `text`, `negativePrompt`, `options` (intensity, etc.)

### POST `/api/models/recommend`
利用 Gemini 3.1 自动决策最佳模型。

## 2. 导演与修复 (Director & Repair)

### POST `/api/ai/director/analyze`
故事脚本深度拆解与自动排版指令生成。

### POST `/api/ai/repair`
画面逻辑诊断与自愈 Prompt 建议。

## 3. 媒体炼金术 (Alchemy)

### POST `/api/ai/translate`
多语种语义翻译。

### POST `/api/ai/voice-morph`
跨音色克隆与迁移。

### POST `/api/ai/spatial/render`
神经辐射场 (NeRF) 3D 重构升维。

### POST `/api/ai/sync-lip`
高精度音画嘴型同步。

## 4. 视觉特效 (VFX)

### POST `/api/ai/relighting/apply`
智能环境重光照渲染。

### POST `/api/ai/vfx/apply`
神经渲染特效叠加。

---
**所有接口均受指数退避重试与性能监控保护**
