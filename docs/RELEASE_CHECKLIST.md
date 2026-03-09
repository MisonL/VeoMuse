# VeoMuse 发布检查清单（2026-03-05）

本清单用于发布前“短流程收口 + 实网回归”执行，不包含 24h 长测。
最近一次本地 Docker 正式复核记录见：`docs/DOCKER_ACCEPTANCE_2026-03-09.md`。
当前研发结项总览见：`docs/RD_CLOSURE_2026-03-07.md`。
当前本地闭环留痕见：`docs/LOCAL_CLOSURE_2026-03-09.md`。
当前交付收口摘要见：`docs/DELIVERY_CLOSURE_2026-03-09.md`。

说明：

- 研发结项已成立。
- 当前清单主要用于“本地复验复跑”和“外部增强验收”。

## 1. 上线前本地复验（可复跑）

```bash
bun run format:check
bun run lint
bun run quality:api-contract
bun run docker:smoke -- --wait-timeout 240
bun run docker:ui-smoke
bun run release:gate
```

通过标准：

- `release:gate` 全绿（security/build/unit/e2e-smoke/e2e-regression/slo）
- `artifacts/quality-summary.json` 中 `status=passed`
- `docker:smoke` 全绿，并覆盖首页/API/WebSocket/安全头/静态缓存
- `docker:ui-smoke` 全绿，并覆盖真实 Docker 浏览器链路
- Docker 服务 `frontend/backend/redis` 为 `healthy`
- 本地 Docker 正式复核留痕已更新到 `docs/DOCKER_ACCEPTANCE_2026-03-09.md`
- Docker 交付与清理说明已更新到 `docs/DOCKER_DELIVERY_RUNBOOK.md`
- 研发结项总览与当前交付状态已更新到 `docs/RD_CLOSURE_2026-03-07.md`
- 当前交付收口摘要已更新到 `docs/DELIVERY_CLOSURE_2026-03-09.md`

## 2. 外部增强验收（有真实环境/真实凭据时执行）

```bash
# 正式部署环境协议级验收（在目标主机本地执行）
bun run acceptance:deploy -- --base-url http://127.0.0.1:18081

# 实网回归统一入口（显式开启真实渠道，并指向已部署实例）
E2E_REAL_CHANNELS=true bun run acceptance:real -- --base-url https://veomuse.example.com --api-base-url https://api.veomuse.example.com
```

通过标准：

- `acceptance:deploy` 返回 0，并生成 `artifacts/deploy-acceptance/<timestamp>/summary.json`
- `acceptance:real` 返回 0
- `artifacts/real-acceptance/<timestamp>/playwright.stdout.log` 中可见 `@real` 外部回归执行记录
- 如需扩展更多 provider 凭据校验，可通过 `E2E_REAL_REQUIRED_ENV_KEYS` 追加必需环境变量列表
- `bun run release:real:precheck` 会自行注入 `E2E_REAL_CHANNELS=true`；`acceptance:real` 仍要求调用方显式设置 `E2E_REAL_CHANNELS=true`
- 本项属于外部增强验收，不影响当前“本地闭环完成”结论

## 3. 发布产物复核

- 质量门禁：`artifacts/quality-summary.json`
- SLO 报告：`artifacts/slo-report.json`
- Playwright 报告：`playwright-report/`、`test-results/playwright/`

## 4. 失败分流（realE2E.failureType）

- `auth`：检查 `GEMINI_API_KEYS`、供应商权限与组织/项目配置
- `quota`：检查供应商额度与限流策略
- `timeout`：检查网络连通与上游延迟，必要时重试
- `upstream_5xx`：标记上游异常窗口并重跑验证
- `unknown`：按失败日志补充可复现步骤后重试
