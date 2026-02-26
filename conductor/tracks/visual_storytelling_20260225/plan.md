# Implementation Plan: 视听叙事大师

## Phase 1: 多音轨架构升级
- [~] **Task: 扩展 Store 与 UI 支持音频**
    - [ ] 允许在 `EditorStore` 中添加音频类型的 Track。
    - [ ] 升级 `MultiVideoPlayer` 支持同步播放音频。
- [ ] **Task: 后端音频合成**
    - [ ] 更新 `CompositionService` 使用 FFmpeg `amix` 混合多音轨。

## Phase 2: 文字叠层系统
- [~] **Task: 实现文字渲染器**
    - [ ] 创建 `TextOverlay` 组件用于预览。
    - [ ] 在 `EditorStore` 中增加文字片段逻辑。
- [ ] **Task: 后端文字合成**
    - [ ] 封装 FFmpeg `drawtext` 逻辑，支持位置、颜色和字体。

## Phase 3: 转场与最终导出抛光
- [~] **Task: 基础转场引擎**
    - [ ] 实现简单的 Cross-fade 转场配置。
    - [ ] 后端升级 FFmpeg `amix` 和 `drawtext`。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
