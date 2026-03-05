# VeoMuse 核心功能清单（V3.2）

本文用于快速审阅当前项目“已完成并可用”的核心能力，按业务域归类。

## 1. AI 创作引擎

### 1.1 视频生成与导演能力

- 能力：导演分析、镜头建议、提示词增强、智能剪辑，以及统一任务化视频生成。
- 视频生成模式：`text_to_video`、`image_to_video`、`first_last_frame_transition`、`video_extend`。
- 生命周期能力：支持 `sync / retry / cancel`，并可通过后端自动同步将活跃任务推进到终态。
- 关键入口：`/api/video/generations*`、`/api/video/generate`、`/api/ai/director/analyze`、`/api/ai/suggest-cuts`、`/api/ai/enhance`。
- 关键测试：`tests/video_generation_api_modes.test.ts`、`tests/video_generation_lifecycle_api.test.ts`、`tests/video_generation_service_cursor.test.ts`、`tests/ai_api.test.ts`、`tests/prompt_enhance.test.ts`、`tests/ai_clip.test.ts`。

### 1.2 媒体炼金能力

- 能力：翻译克隆、风格迁移、VFX、重光照、口型同步、音色迁移、空间重建。
- 关键入口：
  - `/api/ai/translate`
  - `/api/ai/alchemy/style-transfer`
  - `/api/ai/vfx/apply`
  - `/api/ai/sync-lip`
  - `/api/ai/voice-morph`
  - `/api/ai/relighting/apply`
  - `/api/ai/spatial/render`
- 关键测试：
  - `tests/media_alchemy_translation.test.ts`
  - `tests/media_alchemy_style_transfer.test.ts`
  - `tests/vfx_apply_flow.test.ts`
  - `tests/lip_sync_flow.test.ts`

## 2. 多模型总线与渠道治理

### 2.1 模型编排

- 默认模型：`veo-3.1`、`kling-v1`、`sora-preview`、`luma-dream`、`runway-gen3`、`pika-1.5`、`openai-compatible`。
- 关键入口：`/api/models`、`/api/models/marketplace`、`/api/video/generations`、`/api/video/generate`。
- 关键测试：`tests/model_channels.test.ts`、`tests/model_marketplace_api.test.ts`。

### 2.2 策略治理

- 能力：策略创建/更新、模拟、执行记录、预算告警与自动降级。
- 关键入口：`/api/models/policies/**`、`/api/models/policy/simulate`。
- 关键测试：`tests/model_marketplace_policy_api.test.ts`、`tests/model_policy_sandbox_alerts_api.test.ts`。

## 3. 协作平台与治理

### 3.1 组织与工作区

- 能力：组织、工作区、成员权限、审计导出、配额控制。
- 关键入口：`/api/organizations/**`、`/api/workspaces/**`、`/api/projects`（工作区内创建项目）。
- 关键测试：`tests/organization_governance_api.test.ts`、`tests/workspace_api.test.ts`。

### 3.2 协作评论与评审

- 能力：评论、回复、resolve、review、模板应用、批量片段更新。
- 关键入口：
  - `/api/projects/:id/comments`
  - `/api/projects/:id/reviews`
  - `/api/projects/:id/templates`
  - `/api/projects/:id/clips/batch-update`
- 关键测试：`tests/project_comments_reviews_api.test.ts`、`tests/project_templates_batch_update_api.test.ts`。

## 4. V4 实验室能力

### 4.1 可靠性治理

- 能力：error budget、rollback drill、alerts 与 ACK。
- 关键入口：`/api/v4/admin/reliability/**`。
- 关键测试：`tests/v4_key_endpoints_api.test.ts`。

### 4.2 创意工作流

- 能力：workflow 列表/创建/运行、runs 查询、batch jobs、asset reuse。
- 关键入口：
  - `/api/v4/creative/prompt-workflows/**`
  - `/api/v4/creative/batch-jobs/**`
  - `/api/v4/assets/**`
- 关键测试：`tests/v4_key_endpoints_api.test.ts`、`tests/v4_lab_frontend_alignment.test.ts`。

## 5. 编辑器核心体验

- 多轨时间轴、播放器同步、布局自适应、导出编排。
- 关键前端入口：`App.tsx`、`VideoEditor.tsx`、`ComparisonLab.tsx`、`TelemetryDashboard.tsx`。
- 关键后端入口：`/api/video/compose`、`/api/storage/upload-token`。
- 关键测试：
  - `tests/editor_store.test.ts`
  - `tests/player_sync.test.ts`
  - `tests/composition_api.test.ts`
  - `tests/layout_math.test.ts`

## 6. 可观测性与门禁

- 管理指标：`/api/admin/metrics`。
- Provider 健康：`/api/admin/providers/health`、`/api/admin/providers/health/:providerId`。
- SLO 摘要/分解/失败诊断：`/api/admin/slo/**`。
- 数据库健康与修复：`/api/admin/db/**`。
- 发布门禁脚本：`scripts/release_gate.ts`、`scripts/slo_gate.ts`、`scripts/api_contract_guard.ts`。
- `release:gate` 质量汇总（`artifacts/quality-summary.json`）新增 `videoGenerateLoop` 字段，用于追踪视频生成闭环（注册/组织/工作区/生成/导出）在门禁中的执行状态。
- `videoGenerateLoop` 状态与 `E2E Regression` 步骤同步：通过则标记 `passed`，失败则标记 `failed` 并记录重试次数；当重试耗尽后会终止后续步骤（例如 SLO Check），在质量报告中体现“失败即取消后续”。
- `quality-summary.json` 同步新增 `realE2E` 字段：与 `E2E Regression (Real)` 同步记录执行状态、重试次数、失败明细与失败类型（`auth/quota/timeout/upstream_5xx/unknown`），用于实网问题分流。
- 后端支持视频任务自动同步配置：
  - `VIDEO_JOB_AUTO_SYNC_ENABLED`（默认开启）
  - `VIDEO_JOB_AUTO_SYNC_INTERVAL_MS`（默认 `20000`）
  - `VIDEO_JOB_AUTO_SYNC_BATCH_SIZE`（默认 `8`）
  - `VIDEO_JOB_AUTO_SYNC_OLDER_THAN_MS`（默认 `5000`）

## 7. 质量基线

- 单测：`bun run test`
- 覆盖率门禁：`bun run test:coverage`
- API 契约：`bun run quality:api-contract`
- E2E 冒烟：`bun run e2e:smoke`
- 发布门禁：`bun run release:gate`
