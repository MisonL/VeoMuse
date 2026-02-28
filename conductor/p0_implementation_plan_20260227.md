# VeoMuse P0 实施计划（执行版）

更新时间：2026-02-27
来源基线：`conductor/requirements_rebaseline_20260227.md`

## 执行进度（实时）
- [x] `WP-A1` 模型通道闭环（已完成：推荐路由扩展 + 降级策略 + 测试）
- [x] `WP-A2` 媒体炼金术闭环（已完成：style-transfer 真路由 + 翻译克隆 UI + 测试）
- [x] `WP-A3` 数字演员系统闭环（已完成：演员库 API + UI 入口 + 4K HDR 导出预设 + 口型同步测试）
- [x] `WP-A4` 虚实共生闭环（已完成：动捕实验室 + actors/motion-sync + 2D/3D 预览切换 + 空间导出回归测试）
- [x] `WP-A5` 影棚特效与 World-ID 闭环（已完成：VFX 写回片段预览 + world_link/world_id 参数链路 + 回归测试）
- [x] `WP-B1` AI 架构统一与容错自愈（已完成：前端降级恢复入口 + 重试/降级继续编辑动作 + 测试）
- [x] `WP-B2` 时间轴性能与交互升级（已完成：虚拟化 + Action/Optimistic + SyncController 性能预算 + 测试）
- [x] `WP-B3` 亮色主题与动效统一（已完成：亮色默认主题、变量收敛、App 内联主题常量清理 + 测试）
- [x] `WP-C1` 生产安全与自动清理（已完成：Nginx 最小权限 CSP + always 安全头 + 清理任务重试遥测 + 测试）

## 0. 执行目标
在不破坏既有基线能力（BL-01 ~ BL-14）的前提下，关闭全部 P0（19 项），并形成“接口可用 + 前端可操作 + 测试可复现 + 验收可追溯”的闭环。

## 1. 总体策略

### 1.1 三波推进
- 波次 A（业务真空区补齐）：`P0-01 ~ P0-12`
- 波次 B（架构与性能）：`P0-13 ~ P0-18`
- 波次 C（生产安全治理）：`P0-19`

### 1.2 交付门槛（每个任务包都必须满足）
- 自动化测试通过：`bun test tests/*.test.ts`
- 类型检查通过：`bun run build`
- 关键用户路径可手工走通（见每包“手工验收”）
- API 文档与部署文档同步更新

## 2. 任务包拆解（可直接执行）

## WP-A1 模型通道闭环
覆盖需求：`P0-01`、`P0-02`

改动范围：
- 后端
  - `apps/backend/src/services/drivers/LumaDriver.ts`
  - `apps/backend/src/services/drivers/RunwayDriver.ts`
  - `apps/backend/src/services/drivers/PikaDriver.ts`
  - `apps/backend/src/services/ModelRouter.ts`
  - `apps/backend/src/services/VideoOrchestrator.ts`
  - `apps/backend/src/index.ts`
- 前端
  - `apps/frontend/src/components/Editor/ComparisonLab.tsx`
  - `apps/frontend/src/utils/eden.ts`
- 测试
  - 新增 `tests/model_channels.test.ts`
  - 新增 `tests/model_router_recommendation.test.ts`

实现要点：
- 统一三类模型请求结构与错误语义（`ok/not_implemented/error`）。
- 模型推荐提示词中补齐 `luma-dream/runway-gen3/pika-1.5`。
- 前端模型选择器展示与推荐结果一致，推荐可一键回填。

手工验收：
- 打开实验室，左右模型都可选择 Luma/Runway/Pika。
- 触发推荐后，模型下拉值发生变化。
- 提交 `/api/video/generate` 时返回结构统一且含 `provider`。

## WP-A2 媒体炼金术闭环
覆盖需求：`P0-03`、`P0-04`

改动范围：
- 后端
  - `apps/backend/src/services/TranslationService.ts`
  - 新增 `apps/backend/src/services/StyleTransferService.ts`
  - `apps/backend/src/index.ts`
- 前端
  - `apps/frontend/src/components/Editor/PropertyInspector.tsx`
  - `apps/frontend/src/store/editorStore.ts`
- 测试
  - 新增 `tests/media_alchemy_translation.test.ts`
  - 新增 `tests/media_alchemy_style_transfer.test.ts`

实现要点：
- 增加“翻译并克隆”接口输入/输出契约：原片段、目标语言、新片段数据。
- 将 `style-transfer` 从占位返回改为真实服务分发（未配置 provider 仍返回 `not_implemented`）。
- 属性面板增加语言选择器与风格预设卡（至少 2 套）。

手工验收：
- 选中文本/音频片段后点击翻译，时间轴出现新片段。
- 切换风格预设后，片段 `data` 中出现风格参数并有视觉反馈。

## WP-A3 数字演员系统闭环
覆盖需求：`P0-05`、`P0-06`、`P0-07`

改动范围：
- 后端
  - `apps/backend/src/services/ActorConsistencyService.ts`
  - `apps/backend/src/services/LipSyncService.ts`
  - `apps/backend/src/services/CompositionService.ts`
  - `apps/backend/src/index.ts`
- 前端
  - `apps/frontend/src/components/Editor/AssetPanel.tsx`
  - `apps/frontend/src/components/Editor/PropertyInspector.tsx`
  - `apps/frontend/src/App.tsx`
  - `apps/frontend/src/store/editorStore.ts`
- 共享类型
  - `packages/shared/src/types.ts`
- 测试
  - 新增 `tests/virtual_actors_api.test.ts`
  - 新增 `tests/lip_sync_flow.test.ts`
  - 扩展 `tests/composition_service.test.ts`（4K HDR 导出参数）

实现要点：
- 提供演员库 CRUD 最小闭环（至少 list/create/select）。
- 生成参数打通 `sync_lip` 与 `actorId/consistencyStrength`。
- 导出配置补齐 `4k-hdr`，FFmpeg 参数切换到 HDR preset。

手工验收：
- UI 可新增演员并绑定到视频片段。
- 启用口型同步后，后端收到 `sync_lip: true`。
- 导出面板可选 4K HDR，并成功产出文件。

## WP-A4 虚实共生闭环
覆盖需求：`P0-08`、`P0-09`、`P0-10`

改动范围：
- 后端
  - `apps/backend/src/services/SpatialRenderService.ts`
  - `apps/backend/src/index.ts`
  - `apps/backend/src/services/CompositionService.ts`
- 前端
  - `apps/frontend/src/utils/motionSync.ts`
  - `apps/frontend/src/components/Editor/MultiVideoPlayer.tsx`
  - `apps/frontend/src/components/Editor/PropertyInspector.tsx`
  - `apps/frontend/src/store/editorStore.ts`
- 测试
  - 新增 `tests/motion_capture_mapping.test.ts`
  - 新增 `tests/spatial_preview_mode.test.ts`
  - 扩展 `tests/composition_api.test.ts`（`spatial-vr` 导出）

实现要点：
- 动捕数据与演员骨架字段建立映射协议（关键点最小集）。
- 预览区增加 3D 视角开关与交互状态。
- 导出配置补齐 `spatial-vr` 到 API 参数与合成服务。

手工验收：
- 开启动作捕捉后，预览中角色姿态跟随输入变化。
- 开启 3D 模式后可旋转视角。
- 导出空间视频返回成功并写入输出路径。

## WP-A5 影棚特效与 World-ID 闭环
覆盖需求：`P0-11`、`P0-12`

改动范围：
- 后端
  - `apps/backend/src/services/VfxService.ts`
  - `apps/backend/src/services/RelightingService.ts`
  - `apps/backend/src/index.ts`
- 前端
  - `apps/frontend/src/components/Editor/PropertyInspector.tsx`
  - `apps/frontend/src/components/Editor/MultiVideoPlayer.tsx`
  - `apps/frontend/src/components/Editor/VideoEditor.tsx`
- 测试
  - 新增 `tests/vfx_apply_flow.test.ts`
  - 新增 `tests/world_link_consistency.test.ts`

实现要点：
- `vfx/apply` 返回可追踪 `operationId` 与特效参数快照。
- 将 `world_link: true` 加入生成链路参数，保障同场景镜头一致。
- 前端提供特效强度/类型控制与应用状态反馈。

手工验收：
- 特效面板可应用粒子层并看到覆盖预览。
- 连续分镜启用 world-link 后，背景一致性参数可在片段数据中追踪。

## WP-B1 AI 架构统一与容错自愈
覆盖需求：`P0-13`、`P0-14`

改动范围：
- 后端
  - `apps/backend/src/services/BaseAiService.ts`
  - `apps/backend/src/services/TelemetryService.ts`
  - 所有 `apps/backend/src/services/*Service.ts`（AI 调用路径）
  - `apps/backend/src/index.ts`
- 前端
  - `apps/frontend/src/utils/eden.ts`
  - `apps/frontend/src/components/Editor/ToastContainer.tsx`
  - `apps/frontend/src/components/Editor/PropertyInspector.tsx`
  - `apps/frontend/src/App.tsx`
- 测试
  - 新增 `tests/base_ai_inheritance_coverage.test.ts`
  - 新增 `tests/degrade_recovery_ui.test.ts`

实现要点：
- 全 AI 服务统一走 `BaseAiService.request`，统一遥测和重试。
- 失败语义分级：可重试/不可重试/未配置。
- 前端错误反馈提供“重试”与“降级继续编辑”动作。

手工验收：
- 人工注入 5xx/断网时，UI 不崩溃且可继续操作。
- `/api/admin/metrics` 中可看到失败计数与耗时。

## WP-B2 时间轴性能与交互升级
覆盖需求：`P0-15`、`P0-16`、`P0-18`

改动范围：
- 前端
  - `apps/frontend/src/components/Editor/VideoEditor.tsx`
  - `apps/frontend/src/components/Editor/MultiVideoPlayer.tsx`
  - `apps/frontend/src/utils/SyncController.ts`
  - `apps/frontend/src/store/editorStore.ts`
  - `apps/frontend/src/App.tsx`
- 后端（如需配合任务状态）
  - `apps/backend/src/index.ts`
- 测试
  - 新增 `tests/timeline_virtualization.test.ts`
  - 新增 `tests/action_optimistic_flow.test.ts`
  - 扩展 `tests/player_sync.test.ts`（长时间轴/多轨）

实现要点：
- 引入长时间轴虚拟渲染策略，减少 DOM 与重算。
- 将关键异步操作改为 `useActionState/useOptimistic`。
- `SyncController` 对多轨预加载与 seek 同步做性能预算控制。

手工验收：
- 120s+ 时间轴下拖拽、缩放、播放无明显卡顿。
- 发起生成/编辑操作时，界面即时出现乐观反馈。

## WP-B3 亮色主题与动效统一
覆盖需求：`P0-17`

改动范围：
- 前端
  - `apps/frontend/src/theme.css`
  - `apps/frontend/src/App.tsx`
  - `apps/frontend/src/components/Common/Atoms.tsx`
  - `apps/frontend/src/components/Editor/*.css`
- 测试
  - 新增 `tests/light_mode_visual_tokens.test.ts`
  - 扩展 `tests/theme_system.test.ts`

实现要点：
- 清理 App 中内联主题常量，统一收敛到 CSS Variables。
- 关键按钮、Tab、弹层统一 Spring 参数。
- 亮色模式对比度满足可读性，避免色差跳变。

手工验收：
- 亮/暗/系统切换无闪烁。
- 主要交互组件动效手感一致。

## WP-C1 生产安全与自动清理
覆盖需求：`P0-19`

改动范围：
- 网关与部署
  - `config/nginx/nginx.conf`
  - `config/docker/docker-compose.yml`
  - `docs/DEPLOYMENT.md`
- 后端
  - `apps/backend/src/index.ts`
- 测试
  - 新增 `tests/nginx_security_headers.test.ts`
  - 新增 `tests/cleanup_scheduler.test.ts`

实现要点：
- CSP 规则最小权限化并补充 `always` 策略。
- 自动清理任务增加日志级别、失败重试与可观测指标。
- 部署文档增加安全验收命令。

手工验收：
- `curl -I` 可看到完整安全头。
- 超期临时文件会被定时清理并输出日志。

## 3. 依赖关系与执行顺序
- 第一步：`WP-A1`（模型基础能力），完成后才进入 A2/A3/A4/A5。
- 第二步：`WP-A2` 与 `WP-A3` 可并行。
- 第三步：`WP-A4` 与 `WP-A5` 可并行，但依赖 A3 的演员数据结构。
- 第四步：`WP-B1` 完成后再做 `WP-B2`（避免性能优化时反复改错误处理路径）。
- 第五步：`WP-B3` 与 `WP-C1` 收尾。

## 4. 建议提交节奏（Git）
- 每个任务包 1~3 个提交，按“接口 -> UI -> 测试”顺序拆分。
- 每完成一个任务包，更新对应轨道 `plan.md` 勾选与说明。
- 每个波次结束后，补一份简版验收报告到 `conductor/archive/<track>/`。

## 5. 本计划的完成判定
- 19 条 P0 全部关闭。
- 新增测试均通过，且无新增类型错误。
- API 文档、部署文档与实际行为一致。
- 用户可从主界面完成：多模型生成、媒体炼金术、演员一致性、动作捕捉、空间导出、监控与降级恢复。
