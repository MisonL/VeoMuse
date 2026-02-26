# Implementation Plan: 旗舰版终极打磨

## Phase 1: 后端全量架构对齐
- [ ] **Task: AI 服务全量重构**
    - [ ] 将 AiDirectorService, AiClipService 等全部重构为 BaseAiService 的子类。
    - [ ] 验证全站 AI 调用耗时是否均能被监控系统捕捉。
- [ ] **Task: 路由层去臃肿化**
    - [ ] 移除 index.ts 中的冗余异常处理，同步升级全局错误拦截。

## Phase 2: 前端性能飞跃与美学抛光
- [ ] **Task: 实现 SyncController (Native 预览)**
    - [ ] 剥离 MultiVideoPlayer 的 React Effect 逻辑。
    - [ ] 测试多轨道并发播放下的 CPU 负载变化。
- [ ] **Task: 美学细节抛光**
    - [ ] 统一按钮与 Tab 的物理动效。
    - [ ] 优化侧边栏在高密度布局下的视觉层次感。

## Phase 3: 安全堡垒与环境净化
- [ ] **Task: Nginx 安全与自动清理**
    - [ ] 部署 CSP 头与定时文件清理逻辑。
- [ ] **Task: 全站自愈性压力测试**
    - [ ] 模拟各种 API 故障，确保 UI 优雅降级。
- [ ] **Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)**
