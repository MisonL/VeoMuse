# Implementation Plan: 编辑器深度打磨与合成引擎

## Phase 1: 时间轴高级交互 [checkpoint: 44da364]
- [x] **Task: 完善 Store 的更新逻辑** (59ef18f)
    - [x] 增加 `updateClip` 和 `removeClip` Action。
    - [x] 确保拖拽和缩放操作能双向绑定到状态中。
- [x] **Task: 播放器控制条 (Playback Controls)** (b741e12)
    - [x] 实现播放/暂停状态管理。
    - [x] 使用 RAF (requestAnimationFrame) 平滑驱动时间轴运行。
    - [x] **Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)** (Completed)

## Phase 2: 后端合成引擎 [checkpoint: 545964b]
- [x] **Task: 构建 FFmpeg 合成服务** (aca8ae6)
    - [x] 在后端创建 `CompositionService.ts`。
    - [x] 解析时间轴数据，生成 `filter_complex` 命令将片段按时间拼接。
- [x] **Task: 暴露合成 API** (e3ebad5)
    - [x] 增加 `/api/video/compose` 接口。
    - [x] **Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)** (Completed)

## Phase 3: 前后端打通与导出体验 [checkpoint: f0d6a72]
- [x] **Task: 前端导出面板** (3f48caa)
    - [x] 在 UI 增加“导出视频”按钮。
    - [x] 对接合成接口，显示合并进度。
    - [x] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Completed)
