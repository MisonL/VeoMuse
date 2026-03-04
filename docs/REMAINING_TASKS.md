# VeoMuse 剩余任务清单（2026-03-04）

## 结论

- 需要开发的阻塞功能：`0`
- 当前阶段：进入“稳定性增强与实网验证”迭代

## 进行中（非阻塞）

1. 真实渠道回归测试（实网）

- 目标：验证真实第三方模型通道在生产配置下的可用性与稳定性。
- 建议命令：`bun run e2e:regression:real`、`bun run release:gate:real`
- 前置条件：配置真实凭据（例如 `GEMINI_API_KEYS`）

2. 长稳与并发压测

- 目标：建立 24h 稳定性基线与高并发下的协作 ACK 指标基线。
- 建议命令：`bun run stress:collab-ws`
- 验收建议：`ackRate >= 0.99` 且无错误退出

## 仓库描述能力对齐补全计划（新增，2026-03-04）

> 背景：GitHub 仓库描述强调“Gemini Veo + 文本/图片转视频 + 高质量易用体验”。当前后端能力已具备主干，前端工作台与任务完成闭环仍有补全空间。

1. `WP-1` 统一生成工作台（P0，待开始）

- 范围：在前端新增任务化视频生成入口，统一支持 `text_to_video`、`image_to_video`、`first_last_frame_transition`、`video_extend`。
- API：对接 `POST/GET /api/video/generations*`，提供创建、列表、详情、基础筛选。
- 验收：可在 UI 完成四模式提交并查看任务状态流转。
- 测试：补充 API 契约与前端 DOM/逻辑测试。

2. `WP-2` 任务完成态闭环（P0，待开始）

- 范围：新增 provider operation 轮询更新机制，沉淀任务完成态（成功/失败）、输出地址与失败诊断。
- API：补充任务重试/取消（按驱动能力降级处理）。
- 验收：任务可从 `submitted` 稳定进入终态；成功任务可下载，失败任务可定位。
- 测试：新增服务层轮询与状态机回归测试。

3. `WP-3` Gemini 优先接入体验（P1，待开始）

- 范围：新增 Gemini 配置向导、自检提示、能力探测与常见配置错误指引。
- 验收：新环境在完成凭据配置后可在 5 分钟内跑通首个任务。
- 测试：补充配置校验与提示分支测试。

4. `WP-4` 质量门禁与实网回归集成（P1，待开始）

- 范围：把“图文生成闭环”纳入质量门禁报告（mock + real），输出成功率、耗时、失败类型分布。
- 验收：`release:gate` 报告可直接反映生成链路健康度。
- 测试：新增 E2E（mock）并在手工流程保留 real 回归脚本。

### 推荐执行顺序

1. 先做 `WP-1` + `WP-2`（直接补齐仓库描述能力缺口）。
2. 再做 `WP-3` + `WP-4`（提升可用性与可交付稳定性）。

## 已完成基线（摘要）

- 质量门禁：`release:gate` 已通过（build/unit/e2e/slo）
- Docker 健康：`frontend/backend/redis` 均为 healthy
- API 契约守卫：`quality:api-contract` 已通过
- 覆盖率门禁：`test:coverage` 与 `quality:coverage-targets` 已通过

## 备注

若新增业务需求，请以新需求文档或 issue 形式进入下一轮计划，不再按“遗留功能补完”推进。
