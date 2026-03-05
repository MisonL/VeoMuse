# VeoMuse 剩余任务清单（2026-03-05）

## 结论

- 需要开发的阻塞功能：`0`
- 当前阶段：进入“稳定性增强 + 实网验证 + 体验打磨”迭代

## 进行中（非阻塞）

1. 真实渠道回归测试（实网）

- 目标：验证真实第三方模型通道在生产配置下的可用性与稳定性。
- 建议命令：`bun run e2e:regression:real`、`bun run release:gate:real`
- 前置条件：配置真实凭据（例如 `GEMINI_API_KEYS`）

2. 长稳与并发压测

- 目标：建立 24h 稳定性基线与高并发下的协作 ACK 指标基线。
- 建议命令：`COLLAB_STRESS_PROFILE=short bun run stress:collab-ws`（短压）、`COLLAB_STRESS_PROFILE=long bun run stress:collab-ws`（长压）
- 24h soak 命令：`COLLAB_STRESS_PROFILE=long COLLAB_STRESS_DURATION_MINUTES=1440 bun run stress:collab-ws`
- 报告产物：默认写入 `artifacts/collab-ws-stress-summary.json`（可用 `COLLAB_STRESS_OUTPUT` 覆盖）
- 进展：`short` 基线（2026-03-05）`ackRate=1.00`、`errors=0`、`p95AckMs=1417.89`（`artifacts/collab-ws-short-latest.json`）。
- 进展：`long` 基线（2026-03-05）`ackRate=1.00`、`errors=0`、`p95AckMs=465.92`（`artifacts/collab-ws-long-latest.json`）。
- 待完成：24h 连续压测与阈值固化（当前 long 为高并发短周期基线）。
- 验收建议：`ackRate >= 0.99` 且无错误退出

3. 创意工作台体验优化（均衡布局）

- 目标：优化 creative 模式在常见桌面分辨率（1366/1440/1920）下的信息密度与操作可达性。
- 范围：三栏比例、任务列表可读性、终态折叠、自动轮询状态提示。
- 进展：已完成首轮布局参数优化（中心最小宽度 + 左右面板默认值 + 中屏头部密度）与多分辨率 smoke 断言补强。
- 进展：已完成第二轮创意工作台可读性优化（轮询状态徽标、Cursor 可读化、任务状态徽标、Prompt/错误/输出长文本省略显示）并补充前端逻辑单测。
- 进展：已完成第三轮密度优化（主动作前置、查询/分页折叠区、高级输入折叠区、任务列表单主滚动区），并在 1366/1440/1920 smoke 用例中新增关键按钮可达断言。
- 验收建议：无关键控件遮挡、无明显滚动跳动、核心操作一屏可达。

## 仓库描述能力对齐补全状态（更新，2026-03-04）

> 背景：GitHub 仓库描述强调“Gemini Veo + 文本/图片转视频 + 高质量易用体验”。当前后端能力已具备主干，前端工作台与任务完成闭环仍有补全空间。

1. `WP-1` 统一生成工作台（P0，已完成）

- 范围：在前端新增任务化视频生成入口，统一支持 `text_to_video`、`image_to_video`、`first_last_frame_transition`、`video_extend`。
- API：对接 `POST/GET /api/video/generations*`，提供创建、列表、详情、基础筛选。
- 结果：已可在 creative 工作台完成四模式创建、查询、筛选与详情查看。
- 测试：`tests/video_generation_api_modes.test.ts`、`tests/video_generation_workbench_types.test.ts`、`tests/frontend_form_accessibility.test.ts`。

2. `WP-2` 任务完成态闭环（P0，已完成）

- 范围：新增 provider operation 轮询更新机制，沉淀任务完成态（成功/失败）、输出地址与失败诊断。
- API：补充任务重试/取消（按驱动能力降级处理）。
- 结果：已支持 `/sync`、`/retry`、`/cancel`；状态覆盖 `queued/submitted/processing/succeeded/failed/cancel_requested/canceled`。
- 测试：`tests/video_generation_lifecycle_api.test.ts`。

3. `WP-3` Gemini 优先接入体验（P1，已完成）

- 范围：新增 Gemini 配置向导、自检提示、能力探测与常见配置错误指引。
- 结果：creative 模式已提供 Gemini 快检（ready/missing/unknown）与接入引导。
- 测试：`tests/video_generation_workbench_types.test.ts`、`tests/v4_lab_frontend_alignment.test.ts`。

4. `WP-4` 质量门禁与实网回归集成（P1，已完成）

- 范围：把“图文生成闭环”纳入质量门禁报告（mock + real），输出成功率、耗时、失败类型分布。
- 结果：`quality-summary.json` 新增 `videoGenerateLoop` 与 `realE2E`，分别追踪 mock 闭环与实网回归，并记录重试/失败阻断及失败类型分类。
- 测试：`tests/release_gate_script.test.ts`、`tests/release_gate_runtime.test.ts`。

## 下一阶段建议顺序

1. 先执行实网回归（`e2e:regression:real` + `release:gate:real`）并收敛问题。
2. 执行 24h 压测并固化基线阈值。
3. 最后收口 UI/UX 与文档，做一次全链路复验。

## 已完成基线（摘要）

- 质量门禁：`release:gate` 已通过（build/unit/e2e/slo）
- Docker 健康：`frontend/backend/redis` 均为 healthy（2026-03-05 复核）
- API 契约守卫：`quality:api-contract` 已通过
- 覆盖率门禁：`test:coverage` 与 `quality:coverage-targets` 已通过
- 协作压测：`short` 与 `long` 基线均 `ackRate=1.00`、`errors=0`

## 备注

若新增业务需求，请以新需求文档或 issue 形式进入下一轮计划，不再按“遗留功能补完”推进。
