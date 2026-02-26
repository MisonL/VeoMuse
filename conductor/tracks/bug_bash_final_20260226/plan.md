# Implementation Plan: 旗舰版全量 Bug 猎杀

## Phase 1: 时间轴与状态机加固 [checkpoint: 8365362]
- [x] **Task: 磁吸与撤销冲突修复** (8365362)
    - [x] 修复撤销操作后磁吸视觉引导线偶尔残留的 Bug。
- [x] **Task: 轨道边界检查** (8365362)
    - [x] 确保片段拖拽不会超出 duration 总时长。

## Phase 2: 后端 API 与网络鲁棒性 [checkpoint: 8365362]
- [x] **Task: WebSocket 重连机制** (8365362)
    - [x] 前端集成自动重连逻辑。
- [x] **Task: 错误消息标准化** (8365362)
    - [x] 统一全站 AI 报错的 UI 反馈格式。

## Phase 3: 最终性能与视觉巡检 [checkpoint: 8365362]
- [x] **Task: Canvas 渲染内存泄漏检查** (8365362)
    - [x] 检查 Video 实例在多次切换 Tab 后的销毁情况。
    - [x] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Self-Verified)
