# VeoMuse 旗舰版 API 接口文档 (V3.2 Pro)

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
- **Body**: `force`(optional), `reason`(optional)
- **权限**: 若配置 `ADMIN_TOKEN`，需请求头 `x-admin-token`。
- **Response**: `repair`（包含 `status`、`actions`、`backupPath`、`quarantinePath`、`salvage`）。
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

### POST `/api/video/generate`
向模型驱动提交生成任务。
- **Params**: `modelId` (optional), `text`, `negativePrompt`, `options`, `actorId` (optional), `consistencyStrength` (optional), `syncLip` (optional), `sync_lip` (optional, 兼容字段), `worldLink` (optional), `worldId` (optional)
- `sync_lip` 会在服务端标准化为 `syncLip` 后继续透传到模型驱动。
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
- **Params**: `name`(required), `ownerName`(optional)

### GET `/api/workspaces/:id/invites`
获取邀请列表。
- **权限**: Bearer 用户在目标工作区中角色需为 `owner`，否则 `403`。

### POST `/api/workspaces/:id/invites`
创建成员邀请。
- **Params**: `role`(`owner`/`editor`/`viewer`), `expiresInHours`(optional)
- **权限**: Bearer 用户在目标工作区中角色需为 `owner`，否则 `403`。

### POST `/api/workspaces/invites/:code/accept`
接受邀请并加入工作区。
- **Params**: `memberName`
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

---
**说明**：V3.1+ 所有 provider 能力默认“显式状态返回”，避免误判成功。
