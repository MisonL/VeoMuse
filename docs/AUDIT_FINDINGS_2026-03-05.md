# VeoMuse 全链路复核报告（2026-03-05）

## 1. 复核范围与执行方式

- 需求基线：`docs/requirements/PROJECT_REQUIREMENTS.md`、`docs/CORE_FEATURES.md`、`docs/REMAINING_TASKS.md`
- 后端：权限边界、分页一致性、审计链路、接口语义
- 前端：真实页面交互、可访问性、空态/失败态、布局语义
- 发布门禁：CI 工作流、`release_gate` 执行范围、实网回归 guard
- 实测环境：
  - Docker：`docker compose -f config/docker/docker-compose.yml ps`（`frontend/backend/redis` healthy）
  - 健康检查：`curl http://127.0.0.1:18081/api/health` 返回 `{"status":"ok"}`
  - 实网前置：`bun run release:real:precheck` 失败（缺少 `GEMINI_API_KEYS`）
  - 页面实证截图：`artifacts/audit-channel-modal-focus-leak.png`、`artifacts/audit-compare-cta-mismatch.png`

## 2. 结论摘要

- 审计当日识别的发布阻塞项（`P0/P1/S0`）已在后续补丁中完成修复并通过回归验证。
- 当前剩余风险集中在“实网凭据缺失导致无法执行 real E2E”与“长周期稳定性基线（24h）尚未补齐”。
- 在补齐实网凭据与 24h 压测前，不建议声明“全维度生产就绪”。

## 3. 问题清单（按优先级）

### P0-1 工作区渠道接口鉴权边界错误

- 证据：
  - `apps/backend/src/index.ts:960-973`
  - `apps/backend/src/index.ts:985-998`
  - `apps/backend/src/index.ts:198-215`（组织角色鉴权）
  - `apps/backend/src/index.ts:223-249`（工作区角色鉴权）
- 现状：`/api/workspaces/:id/channels*` 使用组织角色鉴权，而非工作区成员鉴权。
- 影响：同组织非工作区成员可读/改工作区渠道配置；工作区 owner 可能被错误拒绝。
- 建议：路由改为 `authorizeWorkspaceRole`；读接口 `viewer+`，写接口 `owner`（或按产品策略最小权限）。

### P1-1 评论分页游标不稳定（同毫秒漏数）

- 证据：
  - `apps/backend/src/services/WorkspaceService.ts:945-957`
  - `apps/backend/src/services/WorkspaceService.ts:952-963`
  - `tests/project_comments_reviews_api.test.ts:117`（通过 `setTimeout` 拉开时间掩盖风险）
- 现状：仅按 `created_at < cursor` 分页，游标无二级排序键。
- 影响：高并发同毫秒写入时跨页漏数据。
- 建议：改为 `(created_at DESC, id DESC)` 复合游标与条件。

### P1-2 渠道审计 trace 链路缺失

- 证据：
  - `apps/backend/src/services/LocalDatabaseService.ts:383-393`（`ai_channel_audits` 无 `trace_id`）
  - `apps/backend/src/services/ChannelConfigService.ts:504-517`（写审计未写 trace）
  - `apps/backend/src/services/OrganizationGovernanceService.ts:409-410`、`:427`（导出固定 `traceId: null`）
- 影响：审计记录无法与请求链路关联，排障与追责断链。
- 建议：为 `ai_channel_audits` 增加 `trace_id`，写入时透传请求 trace，导出读取真实值。

### P1-3 策略创建可重复提交

- 证据：
  - `apps/frontend/src/components/Editor/ComparisonLab.tsx:1188-1220`
  - `apps/frontend/src/components/Editor/comparison-lab/modes/MarketplaceModePanel.tsx:171-179`
  - 页面网络实证：连续点击后 `POST /api/models/policies` 出现两次（reqid `35`、`36`）
- 影响：重复创建/重复失败请求，导致策略数据与用户认知不一致。
- 建议：创建与更新分离 loading 状态，in-flight 禁用按钮；后端增加幂等键防重。

### P1-4 渠道弹窗无障碍不完整（Esc/焦点陷阱/归位）

- 证据：
  - `apps/frontend/src/components/Editor/comparison-lab/ChannelAccessPanel.tsx:227-240`
  - `apps/frontend/src/components/Editor/ComparisonLab.tsx:3625-3649`
  - 代码检索：`ChannelAccessPanel.tsx` 无 `Escape/keydown/focus trap` 处理
  - 页面实证：按 `Esc` 弹窗不关闭；`Tab` 焦点跳到弹窗外“对比”按钮（见截图）
- 影响：键盘与读屏用户无法可靠操作，存在可访问性与合规风险。
- 建议：实现 dialog 焦点管理（打开聚焦、Tab 循环、Esc 关闭、关闭后归位触发按钮）。

### P2-1 模式切换缺少语义状态

- 证据：`apps/frontend/src/components/Editor/comparison-lab/LabToolbar.tsx:63-90`
- 现状：仅依赖 `.active` 视觉状态，无 `aria-selected/aria-controls` 等语义。
- 影响：读屏器无法准确识别当前模式。
- 建议：改为 `tablist/tab` 结构，补齐 ARIA 状态。

### P2-2 对比模式右侧空态 CTA 文案错误

- 证据：`apps/frontend/src/components/Editor/comparison-lab/modes/CompareModePanel.tsx:147-151`
- 现状：右侧空态写“请选择右侧素材”，CTA 却是“去左侧导入素材”。
- 影响：路径引导冲突，增加首次使用成本。
- 建议：改为“去右侧导入素材”或“去素材面板导入素材”。

### P2-3 模型超市缺少列表级 empty/error 状态

- 证据：
  - `apps/frontend/src/components/Editor/ComparisonLab.tsx:1056-1069`
  - `apps/frontend/src/components/Editor/comparison-lab/modes/MarketplaceModePanel.tsx:255-274`
- 现状：失败仅 toast，列表区域无显式失败态/空态提示与重试入口。
- 影响：用户难以判断“接口失败”与“暂无数据”。
- 建议：增加 `loading/error/empty` 状态区与重试按钮，错误区使用 `aria-live`。

### P2-4 FPS 画布缺少可访问性替代信息

- 证据：`apps/frontend/src/components/Editor/TelemetryDashboard.tsx:736`
- 现状：仅 `<canvas>` 图形展示，无文本替代摘要。
- 影响：读屏用户无法获取关键性能信息。
- 建议：增加屏幕阅读器可读摘要（例如最近 30s min/avg/max FPS）。

### S0-1 CI 中 SLO 与 E2E 指向不同后端实例端口

- 证据：
  - `.github/workflows/ci-quality-gate.yml:30,38,59`（33118）
  - `playwright.config.ts:4,48-50`（默认 33117）
- 影响：SLO 与 E2E 可能不在同一实例验证，存在“门禁假绿”。
- 建议：统一实例端口或让 Playwright 复用 seeded 实例。

### S0-2 `release:gate` 默认仅跑 mock 回归

- 证据：
  - `scripts/release_gate.ts:753-754`
  - `package.json:21-22`
- 影响：未打 `@mock` 的回归用例不进入默认门禁，覆盖盲区持续扩大。
- 建议：默认 `release:gate` 跑 `e2e:regression` 全集；`mock` 作为快速前置。

### S1-1 定时 real e2e 缺密钥时 `exit 0`

- 证据：`.github/workflows/e2e-real-manual.yml:54-56`
- 影响：实网回归长期静默跳过，难以及时发现凭据失效。
- 建议：`schedule` guard 失败改 `exit 1`（或至少上报告警事件）。

## 4. 架构与可维护性观察

- `ComparisonLab.tsx` 行数 `3681`，`TelemetryDashboard.tsx` 行数 `1282`，继续堆叠会放大修改半径与回归成本。
- 两个核心文件仍有较多 `any`（见 `ComparisonLab.tsx:104`、`TelemetryDashboard.tsx:73` 等），类型防线偏弱。

## 5. 阻塞与非阻塞建议

- 发布阻塞（已完成）：
  - `P0-1`、`P1-1`、`P1-3`、`P1-4`、`S0-1`、`S0-2`
- 可并行优化（持续项）：
  - `P2-1`、`P2-2`、`P2-3`、`P2-4`、架构拆分与类型收敛

## 6. 复核限制说明

- 由于当前环境缺少 `GEMINI_API_KEYS`，2026-03-05 的真实渠道回归（real E2E）无法执行。
- 本报告的页面结论基于 Docker 运行时前端实测与代码双重证据，不包含第三方真实通道稳定性结论。
