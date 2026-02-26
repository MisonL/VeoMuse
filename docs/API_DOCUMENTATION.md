# VeoMuse 旗舰版 API 接口文档 (V3.1 Pro)

## 1. 视频模型总线 (Model Orchestrator)

### GET `/api/models`
返回当前系统支持的所有已注册模型驱动。

### POST `/api/video/generate`
向指定的 AI 模型提交视频生成任务。
- **Body**: `{ text: string, modelId?: string, negativePrompt?: string }`

### POST `/api/models/recommend`
利用 Gemini 3.1 Pro 根据提示词推荐最佳模型。
- **Body**: `{ prompt: string }`

## 2. 智能导演与创作 (AI Director)

### POST `/api/ai/director/analyze`
将长脚本拆解为分镜列表及排版指令。
- **Body**: `{ script: string }`

### POST `/api/ai/enhance`
提示词深度推理增强（Thinking Level: HIGH）。
- **Body**: `{ prompt: string }`

### POST `/api/ai/repair`
画面逻辑诊断与修复建议。
- **Body**: `{ description: string }`

## 3. 音频与叙事 (Audio & Visual)

### POST `/api/ai/tts`
文字转语音合成。
- **Body**: `{ text: string }`

### POST `/api/ai/voice-morph`
音色克隆与迁移。
- **Body**: `{ audioUrl: string, targetVoiceId: string }`

### POST `/api/ai/analyze-audio`
音频节奏与鼓点分析。
- **Body**: `{ audioUrl: string }`

## 4. 后台合成引擎 (Composition)

### POST `/api/video/compose`
将时间轴 JSON 数据物理合成为 MP4 文件。
- **Body**: `{ timelineData: any }`

---
**所有接口均受 Eden Treaty 强类型保护**
