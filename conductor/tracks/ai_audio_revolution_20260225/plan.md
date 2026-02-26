# Implementation Plan: AI 音频革命

## Phase 1: 智能配音系统 (TTS)
- [~] **Task: 后端配音服务**
    - [ ] 在后端创建 `TtsService.ts`。
    - [ ] 实现文字转音频文件并返回访问路径。
- [ ] **Task: 前端配音集成**
    - [ ] 在 `PropertyInspector` 为文字片段增加“生成配音”按钮。
    - [ ] 成功生成后，自动在音频轨道创建对应时长的 Clip。

## Phase 2: AI 创意配乐
- [~] **Task: 视频语义音频分析**
    - [ ] 利用 Gemini 3.1 分析视频提示词，返回音乐风格标签（如：激昂、忧郁、科技感）。
- [ ] **Task: BGM 自动匹配与加载**
    - [ ] 实现简单的音乐库检索或外部 API 对接。

## Phase 3: 全局音量控制与最终导出
- [~] **Task: 导出音频均衡**
    - [ ] 升级 `CompositionService` 支持音量增益调节。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
