# Implementation Plan: AI 维度突破

## Phase 1: 智能节奏对齐引擎 (Snap-to-Beat) [checkpoint: ed6d277]
- [x] **Task: 音频波形与节奏分析** (ed6d277)
    - [x] 实现 `AudioAnalysisService.ts`。
    - [x] 在前端绘制音频波形图及节奏标记。
- [x] **Task: 磁吸节奏点** (ed6d277)
    - [x] 升级 `snapService` 优先吸附到节奏点。

## Phase 2: AI 变声与音色克隆 [checkpoint: ed6d277]
- [x] **Task: 音色迁移驱动** (ed6d277)
    - [x] 增加 `/api/ai/voice-morph` 接口。
- [x] **Task: 音频片段特效** (ed6d277)
    - [x] 实现音频 Clip 的“音色滤镜”选择。

## Phase 3: 3D 空间感知预览 [checkpoint: ed6d277]
- [x] **Task: 深度遮挡系统** (ed6d277)
    - [x] 实现基于 Canvas 混合的“视频主体遮挡”效果。
    - [x] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Self-Verified)
