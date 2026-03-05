# VeoMuse 旗舰版 API 接口文档 (V3.2)

关联文档：

- 核心功能清单：`docs/CORE_FEATURES.md`
- 部署与门禁：`docs/DEPLOYMENT.md`

## 通用响应约定

- 核心字段：`success`、`status`、`message`、`error`（按接口场景返回）
- `status` 语义：
  - `ok`: 真实执行成功
  - `not_implemented`: 当前环境未配置该 provider
  - `error`: 请求失败或 provider 返回异常

## 鉴权约定（V3.2）

- 用户鉴权统一使用 `Authorization: Bearer <accessToken>`（`/api/auth/register|login|refresh` 除外）。
- 组织作用域接口支持请求头 `x-organization-id` 指定组织；不传时默认使用当前用户第一个组织。
- 工作区/项目接口基于“当前 Bearer 用户在目标工作区中的真实成员角色”做鉴权，不再信任 `x-workspace-actor`。
- 协作 WebSocket 鉴权推荐使用子协议 `Sec-WebSocket-Protocol: veomuse-auth.<accessToken>`，服务端同时兼容 `Authorization: Bearer <accessToken>`（便于压测/后端脚本接入）。

## API 契约守卫自动化

- 路由注册表生成脚本：`bun run scripts/generate_api_route_registry.ts`
  - 默认输入：`apps/backend/src/index.ts`
  - 默认输出：`docs/api-routes.generated.json`
  - 可覆写：`--backend`、`--output`
- 契约守卫脚本：`bun run scripts/api_contract_guard.ts`
  - 默认读取：
    - `docs/api-routes.generated.json`（generated routes）
    - `scripts/api_contract_guard.config.json`（契约过滤配置）
  - 配置字段：
    - `includePrefixes`: 仅检查命中前缀的 endpoint（为空则不过滤）
    - `excludePatterns`: 正则排除规则
    - `manualRequiredEndpoints`: 手工追加的必检 endpoint（可不在 registry 中）
  - 可覆写：`--backend`、`--docs`、`--tests-dir`、`--config`、`--registry`
- 推荐顺序：先更新路由注册表，再补文档与测试，最后执行 `bun run quality:api-contract` 作为门禁。

## 1. 基础与能力发现

### GET `/api/health`

服务健康检查。

### GET `/api/capabilities`

返回当前环境可用的模型与 AI 服务能力矩阵（按环境变量自动探测）。

- 服务能力矩阵包含：`tts`、`voiceMorph`、`spatialRender`、`vfx`、`lipSync`、`audioAnalysis`、`relighting`、`styleTransfer`、`marketplace`、`creativePipeline`、`workspace`、`collaboration`、`storageProvider`。

### GET `/api/admin/metrics`

返回 API 聚合指标与系统资源数据。

- 可选安全：若配置 `ADMIN_TOKEN`，需在请求头携带 `x-admin-token`。
- 包含自动清理任务指标：`api["System-Cleanup"]`（调用次数、耗时、成功率）。

### GET `/api/admin/providers/health`

返回 Provider 健康总览（模型 + 服务）。

- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。
- **Response**:
  - `providers[]`: 每项包含 `providerId`、`category`、`configured`、`status`(`ok`/`degraded`/`not_implemented`)、`latencyMs`、`statusCode`、`traceId`、`errorCode`、`error`
  - `summary`: `{ total, configured, ok, degraded, notImplemented }`

### GET `/api/admin/providers/health/:providerId`

返回单个 Provider 健康状态。

- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。
- Provider 不存在时返回 `404`。

### GET `/api/admin/slo/summary`

返回北极星 SLO 摘要（主链路成功率、非 AI API P95、首次成功平均步数）。

- **Query**: `windowMinutes`(optional, 默认 `1440`，范围 `5-10080`)
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。
- **Response**:
  - `summary.targets`：SLO 阈值（可由环境变量覆盖）
  - `summary.current`：当前窗口观测值
  - `summary.passFlags`：三项达标布尔位
  - `summary.counts`：样本量（journey/non-ai 请求）
  - `summary.sourceBreakdown`：旅程来源分解（`frontend` / `e2e`）

### GET `/api/admin/slo/breakdown`

按接口输出 SLO 分解明细（聚合到 `method + routeKey` 维度）。

- **Query**:
  - `windowMinutes`(optional, 默认 `1440`)
  - `category`(optional: `ai` / `non_ai` / `system`，默认 `non_ai`)
  - `limit`(optional, 默认 `80`，最大 `200`)
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。
- **Response**: `breakdown.items[]`（`count`、`successRate`、`avgMs`、`p95Ms`、`p99Ms`、`lastSeenAt`）

### GET `/api/admin/slo/journey-failures`

按失败旅程输出诊断聚合（按 `failedStage + errorKind + httpStatus` 维度）。

- **Query**:
  - `windowMinutes`(optional, 默认 `1440`)
  - `limit`(optional, 默认 `10`，最大 `200`)
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。
- **Response**:
  - `window`
  - `counts.totalFailJourneys`
  - `items[]`:
    - `failedStage`: `register` / `organization` / `workspace` / `generate` / `export` / `unknown`
    - `errorKind`: `network` / `timeout` / `auth` / `permission` / `quota` / `server` / `unknown`
    - `httpStatus`: `number | null`
    - `count` / `share` / `latestAt`

> 运维说明：`scripts/slo_gate.ts` 生成的 `artifacts/slo-report.json` 会附带 `journeyFailures` 字段，内容即来自该接口，便于发布门禁报告直接定位失败模式。

### POST `/api/admin/slo/seed`

注入 SLO 预热样本（用于 CI 在 `20/10` 样本阈值下稳定执行门禁）。

- **权限**: 需请求头 `x-admin-token`（命中 `ADMIN_TOKEN`）。
- **开关**: `SLO_ADMIN_SEED_ENABLED=true` 时才允许调用；默认关闭，关闭时返回 `403`。
- **Body**:
  - `nonAiSamples`(optional, 默认 `20`，范围 `1-500`)
  - `journeySamples`(optional, 默认 `10`，范围 `1-200`)
  - `source`(optional: `ci` / `manual`，默认 `ci`)
- **Response**:
  - `seed.seedId`
  - `seed.source`
  - `seed.requested` / `seed.applied`（入参与实际生效计数）
  - `seed.generatedAt`
- **错误码**:
  - `401`: 管理员令牌缺失或错误
  - `403`: 功能开关未开启
  - `400`: 参数越界

### GET `/api/admin/db/health`

返回 SQLite 健康状态（`quick_check`/`integrity_check`）。

- **Query**: `mode`(optional: `quick`/`full`，默认 `quick`)
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。

### GET `/api/admin/db/runtime`

返回数据库运行配置与即时健康摘要（用于自愈看板展示）。

- **Response**:
  - `runtime`: `{ dbPath, autoRepairEnabled, runtimeHealthcheckIntervalMs, runtimeHealthcheckEnabled }`
  - `health`: 快速健康检查结果（同 `/api/admin/db/health?mode=quick`）
  - `lastRepair`: 最近一次修复报告（若有）
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。

### POST `/api/admin/db/repair`

触发数据库修复流程（备份 -> 隔离损坏文件 -> 重建表结构 -> 重连）。

- **Body**: `force`(optional), `reason`(optional), `checkMode`(optional: `quick`/`full`)
- `checkMode` 默认策略：
  - `force=false` 时默认 `quick`（降低巡检触发耗时）
  - `force=true` 时默认 `full`（提高强制修复前的完整性判断精度）
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。
- **Response**: `repair`（包含 `status`、`checkMode`、`actions`、`backupPath`、`quarantinePath`、`salvage`）。
- `salvage` 字段用于表示修复时的数据回收结果（是否尝试、回收条数、逐表回收状态）。

### GET `/api/admin/db/repairs`

获取数据库修复历史记录（持久化在 SQLite，默认返回最新 20 条）。

- **Query**:
  - `limit`(optional, 默认 20，最大 100)
  - `offset`(optional, 默认 0，用于分页)
  - `from`(optional, ISO 时间字符串，按 `created_at >= from` 过滤)
  - `to`(optional, ISO 时间字符串，按 `created_at <= to` 过滤)
  - `status`(optional, 如 `ok` / `repaired` / `failed`)
  - `reason`(optional, 修复原因关键词，按 `reason LIKE %keyword%` 过滤)
- **Response**:
  - `repairs`: 当前页修复记录数组
  - `page`: `{ total, hasMore, limit, offset }`
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。

## 2. 核心模型总线 (Model Bus)

### GET `/api/models`

返回当前注册的模型列表。

### GET `/api/models/marketplace`

获取模型超市卡片数据（模型画像 + 运行指标）。

- **Response**: `models[]`，每项包含 `profile` 与 `metrics`。

### GET `/api/models/:id/profile`

获取指定模型画像。

- 模型不存在时返回 `404`。

### POST `/api/models/policy/simulate`

基于预算与优先级模拟智能路由结果。

- **Params**: `prompt`(required), `budgetUsd`(optional), `priority`(optional: `quality`/`speed`/`cost`)
- **Response**: `decision`，包含 `policyId`、`recommendedModelId`、`estimatedCostUsd`、`estimatedLatencyMs`、`confidence`、`scoreBreakdown[]`、`candidates[]`、`budgetGuard`。
- `budgetGuard` 字段说明：
  - `budgetUsd`: 本次模拟预算
  - `alertThresholdRatio`: 阈值比例（默认 0.8，可由 `MODEL_POLICY_BUDGET_ALERT_RATIO` 覆盖）
  - `status`: `ok` / `warning` / `critical` / `degraded`
  - `message`: 预算保护提示
  - `autoDegraded`: 是否触发自动降级至低成本模型

### GET `/api/models/policies`

获取路由治理策略列表。

### POST `/api/models/policies`

创建路由治理策略。

- **Params**: `name`(required), `description`(optional), `priority`(optional), `maxBudgetUsd`(optional), `enabled`(optional), `allowedModels[]`(optional), `weights`(optional), `fallbackPolicyId`(optional)
- `fallbackPolicyId` 需指向已存在策略，且不能形成循环引用；校验失败返回 `400`。

### PATCH `/api/models/policies/:id`

更新路由治理策略。策略不存在返回 `404`。

- 若 `fallbackPolicyId` 非法（不存在/自引用/形成循环）返回 `400`。

### POST `/api/models/policies/:id/simulate`

按指定策略执行模拟。策略不存在返回 `404`。

- **Response**: 与 `/api/models/policy/simulate` 一致，包含 `decision.budgetGuard`（预算阈值告警与自动降级结果）。

### GET `/api/models/policies/:id/executions`

获取策略执行记录（分页）。

- **Query**: `limit`(optional), `offset`(optional)
- **Response**: `executions[]` + `page`

### POST `/api/models/policies/:id/sandbox/simulate-batch`

对指定策略执行批量沙箱模拟（不改变策略，仅返回批量决策结果）。

- **Params**:
  - `scenarios[]`:
    - `prompt`(required)
    - `budgetUsd`(optional)
    - `priority`(optional: `quality` / `speed` / `cost`)
- **Response**:
  - `result.policyId`
  - `result.total`
  - `result.results[]`（每个场景的 `decision`）
  - `result.summary`（`ok` / `warning` / `critical` / `degraded` 计数）

### GET `/api/models/policies/:id/alerts`

查询指定策略的告警配置与告警事件。

- **Query**: `limit`(optional，默认 `50`，最大 `200`)
- **Response**:
  - `config`（策略告警配置）
  - `alerts[]`（按 `created_at DESC` 返回）

### PUT `/api/models/policies/:id/alerts/config`

更新指定策略的告警配置。

- **Params**:
  - `enabled`(optional)
  - `channels[]`(optional，默认至少包含 `dashboard`)
  - `warningThresholdRatio`(optional，自动约束到 `0~1`)
  - `criticalThresholdRatio`(optional，自动约束到 `0~1` 且不低于 `warningThresholdRatio`)
- **Response**: `config`
- **告警落库规则**: `simulate`/`simulate-batch` 产生 `warning`/`critical`/`degraded` 时会写入告警事件表。

### POST `/api/video/generations`

创建并提交视频生成任务（推荐新接口）。

- **Params**:
  - `modelId`(optional，默认 `veo-3.1`)
  - `generationMode`(optional): `text_to_video` | `image_to_video` | `first_last_frame_transition` | `video_extend`
  - `prompt`(optional，兼容 `text`)
  - `negativePrompt`(optional)
  - `inputs`(optional)
    - `image` / `video` / `firstFrame` / `lastFrame`: `{ sourceType, value, mimeType? }`
    - `referenceImages[]`: 同上
    - `sourceType`: `url` | `objectKey`
  - `options`(optional)
  - `workspaceId`(optional)
  - 兼容字段：`actorId`、`consistencyStrength`、`syncLip` / `sync_lip`、`worldLink`、`worldId`
- **校验规则**:
  - `text_to_video` 需要 `prompt` 或 `text`
  - `image_to_video` 需要 `inputs.image` 或 `inputs.referenceImages`
  - `first_last_frame_transition` 需要 `inputs.firstFrame + inputs.lastFrame`
  - `video_extend` 需要 `inputs.video`
  - `objectKey` 输入必须带 `workspaceId` 且首段与 `workspaceId` 一致
- **Response**: `job`（落库任务） + `providerResult`（驱动提交结果）
- **配额治理**: 请求额度/并发额度超限返回 `429` 与 `code: QUOTA_EXCEEDED`。

### GET `/api/video/generations/:jobId`

按任务 ID 查询单个视频生成任务。

- 组织外访问返回 `403`，任务不存在返回 `404`。
- 若任务绑定 `workspaceId`，调用方还需要该工作区成员身份。
- 任务状态：
  - 活动态：`queued` / `submitted` / `processing` / `cancel_requested`
  - 终态：`succeeded` / `failed` / `canceled`
- 终态字段：`outputUrl`、`errorCode`、`finishedAt`、`durationMs`、`retryCount`、`lastSyncedAt`。

### GET `/api/video/generations`

分页查询视频生成任务列表。

- **Query**: `workspaceId`(optional), `status`(optional), `modelId`(optional), `limit`(optional), `cursor`(optional)
- **排序与游标**: 使用 `(created_at DESC, id DESC)` 复合排序，游标格式为 `createdAt|id`，并兼容旧时间戳游标。
- **Response**: `jobs[]` + `page`

### POST `/api/video/generations/:jobId/sync`

触发一次 provider operation 状态同步（按模型驱动能力降级）。

- **权限**：组织成员可访问；若任务绑定 `workspaceId`，需工作区成员身份。
- **Response**:
  - `job`（同步后的任务）
  - `queryResult`（驱动查询结果，含 `state` / `status` / `message` / `outputUrl` 等）
- **降级行为**：驱动未实现 operation 查询时返回 `not_implemented`，并保留任务现状。

### 视频任务自动同步（后台）

- 服务启动后默认开启后台自动同步活跃任务（`queued/submitted/processing/cancel_requested`），用于推进到终态并回填 `outputUrl/errorCode/lastSyncedAt`。
- 环境变量：
  - `VIDEO_JOB_AUTO_SYNC_ENABLED`：是否启用（默认 `true`）
  - `VIDEO_JOB_AUTO_SYNC_INTERVAL_MS`：轮询间隔（默认 `20000`）
  - `VIDEO_JOB_AUTO_SYNC_BATCH_SIZE`：每批同步任务数（默认 `8`）
  - `VIDEO_JOB_AUTO_SYNC_OLDER_THAN_MS`：仅同步“距上次更新时间超过该阈值”的任务（默认 `5000`）
- 说明：前端“自动轮询”主要负责刷新展示；真正的 provider 状态推进由该后台机制和手动 `/sync` 共同完成。

### POST `/api/video/generations/:jobId/retry`

重试已结束任务（复用历史请求体并重新提交到模型驱动）。

- **可重试状态**：`failed` / `succeeded` / `canceled`
- **不可重试状态**：`queued` / `submitted` / `processing` / `cancel_requested`
- **Response**: `job`（已更新） + `providerResult`
- **配额治理**：请求额度/并发额度超限时返回 `429`。

### POST `/api/video/generations/:jobId/cancel`

请求取消任务（按模型驱动能力降级）。

- **可取消状态**：`queued` / `submitted` / `processing` / `cancel_requested`
- **不可取消状态**：`succeeded` / `failed` / `canceled`
- **Response**: `job`（已更新） + `cancelResult`
- **状态流转**：
  - 支持取消的驱动：`cancel_requested -> canceled`
  - 不支持取消的驱动：返回 `not_supported` 并保留任务活动状态（或标记 `cancel_requested`）。

### POST `/api/video/generate`

兼容旧版本的即时提交接口（保留）。

- **Params**: `modelId` (optional), `text`, `negativePrompt`, `options`, `actorId` (optional), `consistencyStrength` (optional), `syncLip` (optional), `sync_lip` (optional), `worldLink` (optional), `worldId` (optional)
- 服务端会将旧字段归一化为统一驱动参数后再分发。
- **配额治理**: 若组织请求额度或并发额度超限，返回 `429` 与 `code: QUOTA_EXCEEDED`。
- **注意**: 未配置 provider 时将返回 `status: not_implemented`，不会再返回“假成功”。

### POST `/api/models/recommend`

利用 Gemini 路由模型推荐最佳生成模型。

## 3. 导演与修复 (Director & Repair)

### POST `/api/ai/director/analyze`

故事脚本拆解与分镜结构生成。

### POST `/api/ai/repair`

画面逻辑诊断与修复 Prompt 建议。

## 4. 媒体炼金术 (Alchemy)

### POST `/api/ai/enhance`

提示词增强。

### POST `/api/ai/translate`

多语种语义翻译。

### POST `/api/ai/alchemy/style-transfer`

视频风格迁移（支持传入 `referenceModel`，如 `luma-dream`、`kling-v1`、`veo-3.1`）。

- 未配置 provider 时返回 `status: not_implemented`。

### POST `/api/ai/tts`

文本转语音。未配置 TTS provider 时返回 `not_implemented`。

### POST `/api/ai/voice-morph`

音色迁移。未配置 provider 时返回 `not_implemented`。

### POST `/api/ai/analyze-audio`

音频节拍分析。未配置 provider 时返回 `not_implemented`。

### POST `/api/ai/spatial/render`

NeRF 空间重构。未配置 provider 时返回 `not_implemented`。

### POST `/api/ai/sync-lip`

音画嘴型同步。未配置 provider 时返回 `not_implemented`。

### GET `/api/ai/actors`

获取演员库列表。

### POST `/api/ai/actors`

创建演员库条目。

- **Params**: `name`, `refImage`

### POST `/api/ai/actors/motion-sync`

将实时动捕数据同步到演员驱动。

- **Params**: `actorId`, `motionData`（包含 `pose[]`、`face`、`timestamp`）

## 5. 创意闭环 (Creative Pipeline)

### POST `/api/ai/creative/run`

创建创意生产 Run，并自动拆解分镜场景。

- **Params**: `script`(required), `style`(optional), `context`(optional)
- **Response**: `run`（包含 `scenes[]`）

### GET `/api/ai/creative/run/:id`

获取指定 Run 详情。

- Run 不存在时返回 `404`。

### POST `/api/ai/creative/run/:id/regenerate`

按反馈重生成指定分镜。

- **Params**: `sceneId`(required), `feedback`(optional)
- Scene 不存在时返回 `404`。

### POST `/api/ai/creative/run/:id/feedback`

提交 Run 级/Scene 级反馈，系统会生成新版本 Run。

- **Params**: `runFeedback`(optional), `sceneFeedbacks[]`(optional: `sceneId`, `feedback`)
- **Response**: `previousRunId`, `run`

### POST `/api/ai/creative/run/:id/commit`

将 Run 提交为完成状态。

- **Params**: `qualityScore`(optional), `notes`(optional)

### GET `/api/ai/creative/run/:id/versions`

获取指定 Run 的版本链。Run 不存在返回 `404`。

## 6. 视觉特效 (VFX)

### POST `/api/ai/relighting/apply`

智能重光照渲染。

### POST `/api/ai/vfx/apply`

神经渲染特效叠加。

## 7. 协作工作区 (Workspace)

### POST `/api/workspaces`

创建工作区（自动创建默认项目与 owner 成员）。

- **Params**: `name`(required), `ownerName`(optional), `idempotencyKey`(optional，建议在客户端重试场景携带)

### GET `/api/workspaces/:id/invites`

获取邀请列表。

- **权限**: Bearer 用户在目标工作区中角色需为 `owner`，否则 `403`。

### POST `/api/workspaces/:id/invites`

创建成员邀请。

- **Params**: `role`(`owner`/`editor`/`viewer`), `expiresInHours`(optional)
- **权限**: Bearer 用户在目标工作区中角色需为 `owner`，否则 `403`。

### POST `/api/workspaces/invites/:code/accept`

接受邀请并加入工作区。

- **Params**: `memberName`, `idempotencyKey`(optional，建议在客户端重试场景携带)
- **Response**: `invite`、`member`、`workspace`、`defaultProject`（便于前端直接接管协作上下文）
- 邀请不存在或过期返回 `404`。

### GET `/api/workspaces/:id/members`

获取工作区成员列表。

### POST `/api/workspaces/:id/members`

添加工作区成员。

- **Params**: `name`, `role`(`owner`/`editor`/`viewer`), `userId`(optional)
- **权限**: Bearer 用户在目标工作区中角色需为 `owner`，否则 `403`。

### GET `/api/workspaces/:id/projects`

获取工作区项目列表。

### POST `/api/projects`

在指定工作区下创建项目。

- **Params**: `workspaceId`(required), `name`(required)
- **权限**: Bearer 用户在目标工作区中角色需至少为 `editor`，否则 `403`。
- 工作区不存在返回 `404`。

### GET `/api/workspaces/:id/presence`

获取在线成员快照。

### GET `/api/workspaces/:id/collab/events`

获取协作事件流（分页）。

- **Query**: `limit`(optional)

### GET `/api/projects/:id/audit`

获取项目级审计日志（最新 100 条）。

### POST `/api/projects/:id/snapshots`

创建项目快照。

- **Params**: `content`(optional)
- **权限**: Bearer 用户在项目所属工作区中角色需至少为 `editor`，否则 `403`。

### GET `/api/projects/:id/snapshots`

查询项目快照历史。

- **Query**: `limit`(optional)

### GET `/api/projects/:id/comments`

查询项目评论（支持 cursor 分页）。

- **Query**:
  - `limit`(optional，默认 `20`，最大 `100`)
  - `cursor`(optional，基于评论 `createdAt` 继续翻页)
- **权限**: `viewer` 及以上可读。

### POST `/api/projects/:id/comments`

创建项目评论。

- **Params**:
  - `content`(required)
  - `anchor`(optional)
  - `mentions[]`(optional)
- **权限**: `editor` 及以上可写。

### POST `/api/projects/:id/comments/:commentId/resolve`

将评论标记为已解决。

- **权限**: `editor` 及以上可写。
- 评论不存在返回 `404`。

### GET `/api/projects/:id/reviews`

查询项目评审记录。

- **Query**: `limit`(optional，默认 `20`，最大 `100`)
- **权限**: `viewer` 及以上可读。

### POST `/api/projects/:id/reviews`

创建项目评审记录。

- **Params**:
  - `decision`(required: `approved` / `changes_requested`)
  - `summary`(required)
  - `score`(optional)
- **权限**: `editor` 及以上可写。

### GET `/api/projects/:id/templates`

查询项目模板列表。

- **权限**: `viewer` 及以上可读。

### POST `/api/projects/:id/templates/apply`

应用指定项目模板并返回回执。

- **Params**:
  - `templateId`(required)
  - `options`(optional)
- **权限**: `editor` 及以上可写。
- **错误语义**: 当 `templateId` 不存在或不属于当前项目时，返回 `404` 与 `Template not found`。

### POST `/api/projects/:id/clips/batch-update`

对项目片段执行批量更新并返回统计回执。

- **Params**:
  - `operations[]`:
    - `clipId`(required)
    - `patch`(required, object)
- **权限**: `editor` 及以上可写。

### POST `/api/storage/upload-token`

签发上传令牌（当前为 `local` provider，接口形态兼容云存储）。

- **Params**: `workspaceId`(required), `projectId`(optional), `fileName`(required), `contentType`(optional)
- **权限**: Bearer 用户在目标工作区中角色需至少为 `editor`，否则 `403`。
- **Response**: `token`（含 `provider`、`objectKey`、`uploadUrl`、`publicUrl`）

### PUT `/api/storage/local-upload/:objectKey`

本地对象存储上传落盘接口（与 `upload-token` 搭配使用）。

- **Body**: 原始二进制内容。
- **权限**: Bearer 用户在 `objectKey` 对应工作区中的角色需至少为 `editor`，否则 `403`。
- `objectKey` 非法时返回 `400`。
- 成功返回 `201` 与 `uploaded`（`objectKey`、`bytes`、`publicUrl`）。
- **配额治理**: 若组织存储额度超限，返回 `429` 与 `code: QUOTA_EXCEEDED`。

### POST `/api/storage/local-import`

本地导入接口（Base64 文件内容转存至服务端导入目录）。

- **Params**: `fileName`(required), `base64Data`(required), `contentType`(optional)
- **权限**: 需 Bearer 登录且具备组织成员身份。
- **配额治理**: 若组织存储额度超限，返回 `429` 与 `code: QUOTA_EXCEEDED`。

### POST `/api/telemetry/journey`

写入用户旅程埋点（用于北极星 SLO 统计）。

- **权限**: 必须 Bearer 登录。
- **Body**:
  - `flowType`: 当前固定为 `first_success_path`
  - `source`: `frontend` / `e2e`（默认 `frontend`）
  - `stepCount`: 必填，且 `>= 1`
  - `success`: 是否成功
  - `durationMs`(optional)
  - `organizationId`(optional)
  - `workspaceId`(optional, 传入时要求调用者是该工作区成员)
  - `sessionId`(optional)
  - `idempotencyKey`(optional，建议与 `sessionId` 配套使用，用于幂等去重)
  - `meta`(optional):
    - `reason`(optional)
    - `failedStage`(optional: `register` / `organization` / `workspace` / `generate` / `export`)
    - `errorKind`(optional: `network` / `timeout` / `auth` / `permission` / `quota` / `server` / `unknown`)
    - `httpStatus`(optional)
- **Response**:
  - `journey.deduplicated`: 是否命中幂等去重
  - 顶层 `deduplicated`: 与 `journey.deduplicated` 同步，便于前端快速判断
- **安全约束**:
  - 传 `workspaceId` 时会校验真实工作区成员身份
  - 传 `organizationId` 时会校验真实组织成员身份

### WS `/ws/collab/:workspaceId`

多人协作实时通道。

- **Query**: `sessionId`(optional)
- **鉴权**: 推荐通过 `Sec-WebSocket-Protocol: veomuse-auth.<accessToken>` 传入访问令牌；服务端兼容 `Authorization: Bearer <accessToken>`。
- **安全约束**: Bearer 用户必须是该工作区真实成员，否则握手后立即返回错误并断开。
- **消息类型**: `presence.heartbeat`、`presence.leave`、`timeline.patch`、`project.patch`、`cursor.update`

## 8. 导出与合成

### POST `/api/video/compose`

提交时间轴合成任务，返回导出文件路径。

- `timelineData.exportConfig.quality` 支持：`standard`、`4k-hdr`、`spatial-vr`。
- **配额治理**: 若组织请求额度、并发额度或存储额度超限，返回 `429` 与 `code: QUOTA_EXCEEDED`。

## 9. 组织治理与审计导出

### GET `/api/organizations/:id/quota`

读取组织级配额与当前使用量。

- **权限**: 组织 `member` 及以上可读。
- **Response**: `quota` + `usage`。

### PUT `/api/organizations/:id/quota`

更新组织级配额。

- **权限**: 组织 `admin` 及以上可写。
- **Params**: `requestLimit`(optional), `storageLimitBytes`(optional), `concurrencyLimit`(optional)
- 数值为 `0` 代表“不限制”。

### GET `/api/organizations/:id/audits/export`

导出组织审计日志（渠道配置审计 + 工作区关键操作审计）。

- **权限**: 组织 `admin` 及以上可导出。
- **Query**:
  - `format`: `json` / `csv`
  - `scope`: `all` / `channel` / `workspace`
  - `from`(optional), `to`(optional), `limit`(optional, 最大 `5000`)
- `format=csv` 时返回下载文件流（`text/csv`）；`format=json` 时返回结构化 JSON。

## 10. V4 关键端点增量（Stream D）

### 10.1 Reliability（Admin）

- `GET /api/v4/admin/reliability/error-budget`
- `PUT /api/v4/admin/reliability/error-budget`
- `POST /api/v4/admin/reliability/drills/rollback`
- `GET /api/v4/admin/reliability/drills/:drillId`
- `GET /api/v4/admin/reliability/alerts`
- `POST /api/v4/admin/reliability/alerts/:alertId/ack`
- 鉴权：若配置 `ADMIN_TOKEN`，需传 `x-admin-token`；测试/开发环境可按服务端配置放行。
- `GET /error-budget` Query：`policyId`(optional)
- `PUT /error-budget` Body：`policyId`(optional), `scope`(optional), `targetSlo`(optional), `windowDays`(optional), `warningThresholdRatio`(optional), `alertThresholdRatio`(optional), `freezeDeployOnBreach`(optional), `updatedBy`(optional), `meta`(optional)
- `POST /drills/rollback` Body：`policyId`(optional), `environment`(optional), `status`(optional: `scheduled|running|completed|failed`), `triggerType`(optional), `initiatedBy`(optional), `summary`(optional), `plan`(optional), `result`(optional), `startedAt`(optional), `completedAt`(optional)
- `GET /alerts` Query：`level`(optional: `info|warning|critical`), `status`(optional: `open|acknowledged`), `limit`(optional)
- `POST /alerts/:alertId/ack` Body：`acknowledgedBy`(optional), `note`(optional)。返回 `{ success: true, alert }`，并将 `payload.ack = { by, at, note? }`。

请求示例：

```bash
curl -s http://127.0.0.1:18081/api/v4/admin/reliability/error-budget \
  -X PUT \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"policyId":"rel_policy_stream_d","targetSlo":0.985,"windowDays":14,"warningThresholdRatio":0.6,"alertThresholdRatio":0.85,"updatedBy":"ops-admin"}'
```

```bash
curl -s http://127.0.0.1:18081/api/v4/admin/reliability/drills/rollback \
  -X POST \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"policyId":"rel_policy_stream_d","status":"failed","initiatedBy":"ops-admin","summary":"回滚演练失败"}'
```

```bash
curl -s http://127.0.0.1:18081/api/v4/admin/reliability/alerts/${ALERT_ID}/ack \
  -X POST \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"acknowledgedBy":"ops-oncall","note":"已确认，进入修复流程"}'
```

### 10.2 Comment Threads / Replies / Resolve

- `GET /api/v4/projects/:projectId/comment-threads`
- `POST /api/v4/projects/:projectId/comment-threads`
- `POST /api/v4/projects/:projectId/comment-threads/:threadId/replies`
- `POST /api/v4/projects/:projectId/comment-threads/:threadId/resolve`
- 权限：`viewer` 可读，`editor` 可创建/回复/解决。
- `GET /comment-threads` Query：`cursor`(optional), `limit`(optional)
- `GET /comment-threads` Response：除 `threads` 外额外返回 `page`，结构为 `{ limit, hasMore, nextCursor }`。
- 游标语义：采用稳定复合游标（`created_at|id`），排序为 `created_at DESC, id DESC`。
- 兼容性：仍接受旧版时间戳游标（仅 `created_at`），但推荐将 `nextCursor` 视为 opaque token 原样透传。
- `limit` 上限为 `100`。
- `POST /comment-threads` Body：`anchor`(optional), `content`(required), `mentions`(optional)
- `POST /replies` Body：`content`(required), `mentions`(optional)

请求示例：

```bash
curl -s http://127.0.0.1:18081/api/v4/projects/${PROJECT_ID}/comment-threads \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"anchor":"timeline:track-v1:clip-hero","content":"请补充过渡帧","mentions":["qa","director"]}'
```

```bash
curl -s http://127.0.0.1:18081/api/v4/projects/${PROJECT_ID}/comment-threads/${THREAD_ID}/resolve \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json"
```

### 10.3 Workspace Permissions

- `GET /api/v4/workspaces/:workspaceId/permissions`
- `PUT /api/v4/workspaces/:workspaceId/permissions/:role`
- 权限：`viewer+` 可读，`owner` 可写。
- `PUT` Path 参数 `role` 仅支持：`owner|editor|viewer`
- `PUT` Body：`permissions`(required, `Record<string, boolean>`), `updatedBy`(optional)

请求示例：

```bash
curl -s http://127.0.0.1:18081/api/v4/workspaces/${WORKSPACE_ID}/permissions/viewer \
  -X PUT \
  -H "Authorization: Bearer ${OWNER_ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"permissions":{"project.comments.view":true,"asset.reuse.view":true,"timeline.merge":false},"updatedBy":"owner-ops"}'
```

### 10.4 Timeline Merge

- `POST /api/v4/projects/:projectId/timeline/merge`
- 权限：`editor+`
- Body：`sourceRevision`(optional), `targetRevision`(optional), `conflicts`(optional), `result`(optional), `status`(optional: `merged|conflict`)

请求示例：

```bash
curl -s http://127.0.0.1:18081/api/v4/projects/${PROJECT_ID}/timeline/merge \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"sourceRevision":"rev-a","targetRevision":"rev-b","conflicts":[{"clipId":"clip-v1","reason":"overlap"}],"result":{"mergedClips":2}}'
```

### 10.5 Creative Workflows / Batch Jobs

- `GET /api/v4/creative/prompt-workflows`
- `POST /api/v4/creative/prompt-workflows`
- `GET /api/v4/creative/prompt-workflows/:workflowId/runs`
- `POST /api/v4/creative/prompt-workflows/:workflowId/run`
- `GET /api/v4/creative/batch-jobs`
- `POST /api/v4/creative/batch-jobs`
- `GET /api/v4/creative/batch-jobs/:jobId`
- 鉴权：组织 `member+`，建议始终携带 `x-organization-id`
- `GET /prompt-workflows` Query：`limit`(optional)
- `POST /prompt-workflows` Body：`name`(required), `description`(optional), `definition`(optional), `createdBy`(optional)
- `GET /prompt-workflows/:workflowId/runs` Query：`limit`(optional, max `100`), `cursor`(optional)。返回 `{ success, runs, page }`，其中 `page = { limit, hasMore, nextCursor }`，游标语义为稳定复合游标（`created_at|id`），排序为 `created_at DESC, id DESC`。
- 兼容性：仍接受旧版时间戳游标（仅 `created_at`），但推荐直接使用服务端返回的 `nextCursor`。
- `POST /:workflowId/run` Body：`triggerType`(optional), `input`(optional), `createdBy`(optional)
- `GET /batch-jobs` Query：`limit`(optional, max `100`), `cursor`(optional), `workflowRunId`(optional), `jobType`(optional), `status`(optional: `queued|completed|failed`)。返回 `{ success, jobs, page }`，其中 `page = { limit, hasMore, nextCursor }`，游标语义为稳定复合游标（`created_at|id`），排序为 `created_at DESC, id DESC`。
- `POST /batch-jobs` Body：`workflowRunId`(optional), `jobType`(required), `payload`(optional), `items`(optional), `createdBy`(optional)

请求示例：

```bash
curl -s http://127.0.0.1:18081/api/v4/creative/prompt-workflows \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"name":"product-launch-workflow","description":"新品镜头工作流","definition":{"template":"为 {{product}} 生成 {{style}} 风格镜头"}}'
```

```bash
curl -s http://127.0.0.1:18081/api/v4/creative/prompt-workflows/${WORKFLOW_ID}/run \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"triggerType":"manual","input":{"product":"智能手表","style":"电影感"}}'
```

```bash
curl -s "http://127.0.0.1:18081/api/v4/creative/prompt-workflows/${WORKFLOW_ID}/runs?limit=20" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}"
```

```bash
curl -s http://127.0.0.1:18081/api/v4/creative/batch-jobs \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"workflowRunId":"pwfr_xxx","jobType":"creative.render","items":[{"itemKey":"shot-1","input":{"durationSec":8}}]}'
```

```bash
curl -s "http://127.0.0.1:18081/api/v4/creative/batch-jobs?limit=20" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}"
```

### 10.6 Asset Reuse History

- `POST /api/v4/assets/:assetId/reuse`
- `GET /api/v4/assets/reuse-history`
- 鉴权：组织 `member+`
- `POST /reuse` Body：`sourceProjectId`(optional), `targetProjectId`(optional), `reusedBy`(optional), `context`(optional)
- `GET /reuse-history` Query：`assetId`(optional), `sourceProjectId`(optional), `targetProjectId`(optional), `limit`(optional), `offset`(optional)

请求示例：

```bash
curl -s http://127.0.0.1:18081/api/v4/assets/${ASSET_ID}/reuse \
  -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"sourceProjectId":"prj_src","targetProjectId":"prj_dst","context":{"sceneId":"scene-hero","reason":"跨项目复用"}}'
```

```bash
curl -s "http://127.0.0.1:18081/api/v4/assets/reuse-history?assetId=${ASSET_ID}&limit=20" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}"
```

---

**说明**：V3.2+ 所有 provider 能力默认“显式状态返回”，避免误判成功。
