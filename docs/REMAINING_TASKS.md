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

## 已完成基线（摘要）

- 质量门禁：`release:gate` 已通过（build/unit/e2e/slo）
- Docker 健康：`frontend/backend/redis` 均为 healthy
- API 契约守卫：`quality:api-contract` 已通过
- 覆盖率门禁：`test:coverage` 与 `quality:coverage-targets` 已通过

## 备注

若新增业务需求，请以新需求文档或 issue 形式进入下一轮计划，不再按“遗留功能补完”推进。
