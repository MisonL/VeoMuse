# Implementation Plan: 编辑器深度打磨与合成引擎

## Phase 1: 时间轴高级交互
- [x] **Task: 完善 Store 的更新逻辑** (59ef18f)
    - [x] 增加 `updateClip` 和 `removeClip` Action。
    - [x] 确保拖拽和缩放操作能双向绑定到状态中。
- [ ] **Task: 播放器控制条 (Playback Controls)**
    - [ ] 实现播放/暂停状态管理。
    - [ ] 使用 RAF (requestAnimationFrame) 平滑驱动时间轴运行。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)**

## Phase 2: 后端合成引擎
- [ ] **Task: 构建 FFmpeg 合成服务**
    - [ ] 在后端创建 `CompositionService.ts`。
    - [ ] 解析时间轴数据，生成 `filter_complex` 命令将片段按时间拼接。
- [ ] **Task: 暴露合成 API**
    - [ ] 增加 `/api/video/compose` 接口。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)**

## Phase 3: 前后端打通与导出体验
- [ ] **Task: 前端导出面板**
    - [ ] 在 UI 增加“导出视频”按钮。
    - [ ] 对接合成接口，显示合并进度。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
