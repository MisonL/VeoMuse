# Implementation Plan: 虚实共生

## Phase 1: AI 实时动作捕捉 (Motion Sync)
- [~] **Task: 摄像头动捕流驱动**
    - [ ] 集成人体关键点识别逻辑。
- [ ] **Task: 虚拟演员实时同步**
    - [ ] 将动捕数据映射到 `ActorConsistencyService` 驱动中。

## Phase 2: 神经辐射场 (NeRF) 升维渲染
- [ ] **Task: 深度场估计后端**
    - [ ] 增加 `/api/ai/spatial/render` 接口。
- [ ] **Task: 3D 自由视角预览**
    - [ ] 升级播放器支持 Three.js 驱动的 3D 预览模式。

## Phase 3: 沉浸式导出与项目总结
- [ ] **Task: 空间视频编码器**
    - [ ] 升级 FFmpeg 支持 MV-HEVC 空间视频导出。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Self-Verified)
