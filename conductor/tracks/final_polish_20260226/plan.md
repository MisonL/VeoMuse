# Implementation Plan: 旗舰版全功能极致打磨

## Phase 1: 音频均衡与渲染反馈
- [ ] **Task: 实现自动避让 (Audio Ducking) 逻辑**
    - [ ] 升级后端 FFmpeg 参数支持音量权重。
- [ ] **Task: 增加渲染占位动效**
    - [ ] 在前端 `VideoEditor` 中为无 src 的 Clip 增加流光效果。

## Phase 2: 交互细节与图标
- [ ] **Task: 转场图标与控制**
    - [ ] 在片段衔接处渲染转场标识。
- [ ] **Task: 玻璃拟态 Notification 组件**
    - [ ] 实现自定义 Toast 系统取代 alert。

## Phase 3: 架构纯净度抛光
- [ ] **Task: CSS 变量化重构**
    - [ ] 统一管理全站色值。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
