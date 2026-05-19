# VeoMuse 运营证据索引

本文汇总 V3.3 可运营交付闭环使用的证据入口。它不替代 `docs/RELEASE_CHECKLIST.md`，只作为发布、部署、验收、演练和安全证据的总索引。

## 质量门禁

- Workflow：`CI · Quality Gate`
- 文件：`.github/workflows/ci-quality-gate.yml`
- 入口：`bun run release:gate`
- Artifact：`quality-gate-artifacts`
- 关键产物：`artifacts/quality-summary.json`
- SLO 产物：`artifacts/slo-report.json`
- 通过标准：Release Gate job 为 success，且 quality summary 与 SLO report 已上传。

## Docker Delivery

- Workflow：`CI · Quality Gate`
- Job：`Docker Delivery`
- 入口：`bun run docker:smoke -- --wait-timeout 420 --keep-up`
- 浏览器入口：`bun run docker:ui-smoke`
- Artifact：`docker-ui-smoke-artifacts`
- 关键产物：`test-results/playwright-docker/`
- 通过标准：Docker smoke、Docker UI smoke、artifact upload、compose cleanup 均完成。

## 部署态只读验收

- 命令：`bun run acceptance:deploy -- --base-url http://127.0.0.1:18081`
- 产物：`artifacts/deploy-acceptance/<timestamp>/summary.json`
- 通过标准：summary 记录目标 base URL、健康探测、只读验收步骤与失败原因。

## 真实渠道验收

- 命令：`E2E_REAL_CHANNELS=true bun run acceptance:real -- --base-url https://veomuse.example.com --api-base-url https://api.veomuse.example.com`
- 产物：`artifacts/real-acceptance/<timestamp>/summary.json`
- 通过标准：真实环境 precheck、就绪探测、外部 real 回归与失败步骤均被记录。
- 跳过条件：真实渠道环境变量或凭证缺失时，只能标记为未执行，不能标记为通过。

## DB 修复演练

- Manual workflow：`Manual · DB Repair Drill`
- 命令：`bun run drill:db-repair`
- Artifact：`db-repair-drill-artifacts`
- 关键产物：`data/drills/`、`artifacts/db-repair-drill.log`
- 通过标准：损坏注入、检测、备份、修复和演练日志完整。

## 协作 WebSocket 压测

- Manual workflow：`Manual · Collaboration WS Stress`
- 命令：`bun run stress:collab-ws`
- Artifact：`stress-artifacts`
- 关键产物：`artifacts/stress-collab-ws.log`
- 通过标准：压测脚本退出 0，artifact 上传成功。

## 安全扫描

- Workflow：`CI · Security Secrets Scan`
- 轻量入口：`bun run security:scan`
- 深度扫描：`docker run zricethezav/gitleaks:v8.30.1 detect`
- SARIF：`gitleaks.sarif`
- 通过标准：Bun Secrets Guard 与 Gitleaks Deep Scan 均为 success。
