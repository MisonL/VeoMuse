# VeoMuse 发布检查清单

发布前请先阅读：

- `docs/ENGINEERING_WORKFLOW.md`
- `docs/TDD_WORKFLOW.md`
- `docs/DEPLOYMENT.md`

## 1. 本地质量门禁

```bash
bun run format:check
bun run lint
bun run test
bun run quality:api-contract
bun run release:gate
```

通过标准：

- `release:gate` 返回 0
- `artifacts/quality-summary.json` 存在且状态通过
- `artifacts/slo-report.json` 已生成

## 2. Docker 验收

```bash
bun run docker:smoke -- --wait-timeout 240
bun run docker:ui-smoke
```

通过标准：

- `redis/backend/frontend` 为 `healthy`
- Docker 协议链路和浏览器链路均通过

## 3. 部署态留痕

```bash
bun run acceptance:deploy -- --base-url http://127.0.0.1:18081
E2E_REAL_CHANNELS=true bun run acceptance:real -- --base-url https://veomuse.example.com --api-base-url https://api.veomuse.example.com
```

通过标准：

- `artifacts/deploy-acceptance/<timestamp>/summary.json`
- `artifacts/real-acceptance/<timestamp>/summary.json`

证据索引与跳过口径见：`docs/OPERATIONAL_EVIDENCE.md`。

## 4. 清理

```bash
bun run docker:reset
bun run clean
```
