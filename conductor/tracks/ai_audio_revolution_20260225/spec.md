# Specification: AI 音频革命计划

## 目标
利用最前沿的 AI 技术，为视频内容提供自动化的音频创作闭环，包括语音合成与风格化配乐。

## 关键技术栈
- **TTS (Text-to-Speech)**: 集成 Google Cloud Text-to-Speech API 或类似的顶级人声合成服务。
- **音频处理**: Web Audio API 用于前端预览，FFmpeg `amix` 和 `loudnorm` 用于后端均衡。
- **AI 音乐匹配**: 利用 Gemini 3.1 Pro 语义分析，生成配乐描述词。

## 预期产出
- “文字片段”属性面板增加“生成配音”按钮。
- “音频轨道”支持通过 AI 描述直接搜索/生成 BGM。
- 视频导出时，配音与 BGM 自动平衡音量层级。
