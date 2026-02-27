# Implementation Plan: 工匠之手

## Phase 1: 属性检查器与选中逻辑 [checkpoint: 81a2b5d]
- [x] **Task: 实现片段选中状态** (81a2b5d)
    - [x] 在 `EditorStore` 增加 `selectedClipId`。
- [x] **Task: 构建 PropertyInspector 组件** (81a2b5d)
    - [x] 根据选中片段类型（视频/音频/文字）展示不同调节项。

## Phase 2: 时间轴精细化控制 [checkpoint: 81a2b5d]
- [x] **Task: 实现动态缩放** (81a2b5d)
    - [x] 在工具栏增加缩放滑块。
- [x] **Task: 快捷键增强** (81a2b5d)
    - [x] 支持 `Backspace/Delete` 删除选中片段。

## Phase 3: 上下文菜单与最终打磨 [checkpoint: 81a2b5d]
- [x] **Task: 自定义右键菜单** (81a2b5d)
    - [x] 实现“分割片段”、“复制”等功能。
    - [x] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Self-Verified)
