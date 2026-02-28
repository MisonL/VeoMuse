# Implementation Plan: AI 影棚级进化

## Phase 1: 智能重光照引擎 (AI Relighting) [checkpoint: 9e78ed6]
- [x] **Task: 后端光影重塑服务** (9e78ed6)
- [x] **Task: 前端光影控制 UI** (9e78ed6)

## Phase 2: 神经渲染 VFX 模块
- [x] **Task: 特效驱动开发**
    - [x] 增加 `/api/ai/vfx/apply` 接口。
- [x] **Task: 粒子层预览集成**
    - [x] 升级播放器支持特效层混合预览。

## Phase 3: 全场景一致性 (World-Link)
- [x] **Task: 实现 World-ID 调度**
    - [x] 确保生成多个镜头时使用相同的场景种子或参考图。
    - [x] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)** (Self-Verified 2026-02-28)
