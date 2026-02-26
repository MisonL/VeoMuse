# Implementation Plan: 旗舰版全量 Bug 猎杀

## Phase 1: 时间轴与状态机加固
- [ ] **Task: 磁吸与撤销冲突修复**
    - [ ] 修复撤销操作后磁吸视觉引导线偶尔残留的 Bug。
- [ ] **Task: 轨道边界检查**
    - [ ] 确保片段拖拽不会超出 duration 总时长。

## Phase 2: 后端 API 与网络鲁棒性
- [ ] **Task: WebSocket 重连机制**
    - [ ] 前端集成自动重连逻辑。
- [ ] **Task: 错误消息标准化**
    - [ ] 统一全站 AI 报错的 UI 反馈格式。

## Phase 3: 最终性能与视觉巡检
- [ ] **Task: Canvas 渲染内存泄漏检查**
    - [ ] 检查 Video 实例在多次切换 Tab 后的销毁情况。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
