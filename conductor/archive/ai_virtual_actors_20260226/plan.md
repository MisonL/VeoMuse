# Implementation Plan: 数字人永生

## Phase 1: 虚拟演员一致性引擎
- [~] **Task: 实现角色一致性驱动**
    - [ ] 创建 `ActorConsistencyService.ts`。
    - [ ] 封装角色引用图 (Character Reference) 逻辑。
- [ ] **Task: 演员库 UI 闭环**
    - [ ] 在左侧控制台新增“演员”标签页。

## Phase 2: 高精度对口型 (Lip-Sync)
- [ ] **Task: 实现音画嘴型同步接口**
    - [ ] 增加 `/api/ai/sync-lip` 接口。
- [ ] **Task: 属性面板增加同步开关**
    - [ ] 支持为带有人物的视频一键对齐配音。

## Phase 3: 4K HDR 极致渲染
- [ ] **Task: 升级 Master 渲染器**
    - [ ] 支持 4K 分辨率和 10bit 色深导出。
    - [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
