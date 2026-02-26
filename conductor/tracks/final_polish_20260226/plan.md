# Implementation Plan: 旗舰版全功能极致打磨

## Phase 1: 音频均衡与渲染反馈 [checkpoint: 435dd3b]
- [x] **Task: 实现自动避让 (Audio Ducking) 逻辑** (435dd3b)
    - [x] 升级后端 FFmpeg 参数支持音量权重。
- [x] **Task: 增加渲染占位动效** (435dd3b)
    - [x] 在前端 `VideoEditor` 中为无 src 的 Clip 增加流光效果。

## Phase 2: 交互细节与图标 [checkpoint: 435dd3b]
- [x] **Task: 转场图标与控制** (435dd3b)
    - [x] 在片段衔接处渲染转场标识。
- [x] **Task: 玻璃拟态 Notification 组件** (435dd3b)
    - [x] 实现自定义 Toast 系统取代 alert。

## Phase 3: 架构纯净度抛光 [checkpoint: 435dd3b]
- [x] **Task: CSS 变量化重构** (435dd3b)
    - [x] 统一管理全站色值。
    - [x] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Self-Verified)
