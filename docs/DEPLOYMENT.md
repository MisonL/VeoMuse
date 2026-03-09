# VeoMuse 生产部署指南（V3.2）

当前研发结项总览见：`docs/RD_CLOSURE_2026-03-07.md`。
Docker 交付验收与清理手册见：`docs/DOCKER_DELIVERY_RUNBOOK.md`。
最新一次本地 Docker 正式复核记录见：`docs/DOCKER_ACCEPTANCE_2026-03-09.md`。
最新一次本地闭环结项记录见：`docs/LOCAL_CLOSURE_2026-03-09.md`。
最新交付收口摘要见：`docs/DELIVERY_CLOSURE_2026-03-09.md`。

## 一键部署

系统已完全容器化，前端镜像会在构建阶段自动执行前端构建（无需宿主机预先生成 `dist`）。
支持 macOS/Linux/Windows 三平台一键部署：

```bash
# macOS / Linux
bash scripts/one-click-deploy.sh
```

```powershell
# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/one-click-deploy.ps1
```

```bat
:: Windows CMD（可双击）
scripts\\one-click-deploy.cmd
```

脚本会自动完成：

- 创建或修复 `.env` 中生产必需安全变量（随机强密钥）。
- 自动启动 Docker Compose 集群（默认带 `--build`）。
- 自动等待 `http://127.0.0.1:18081/api/health` 网关/API 联通检查通过。

### Compose 健康检查与启动顺序

- `docker-compose.yml` 已为 `redis/backend/frontend` 配置 `healthcheck`。
- 后端与前端容器均通过 `/api/health` 进行 HTTP 健康探测（分别为 `33117/18081` 端口）。
- 服务依赖链采用 `depends_on.condition: service_healthy`：
  - `backend` 等待 `redis` 健康后启动。
  - `frontend` 等待 `backend` 健康后启动。
- 建议在手动部署时使用 `--wait`，确保服务健康后再进入验收。

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose -f config/docker/docker-compose.yml ps
```

### 一键脚本参数

- `--force-env` / `-ForceEnv`：强制重建关键安全变量（会备份旧 `.env`）。
- `--skip-build` / `-SkipBuild`：跳过镜像重建，直接 `up -d`。
- `--api-port <port>` / `-ApiPort <port>`：自定义健康检查端口。

### Nginx 配置映射

- 仓库中的真实配置文件路径是 `config/nginx/nginx.conf`。
- 前端镜像构建时会把它复制到容器内 `/etc/nginx/conf.d/default.conf`。
- 因此排查部署问题时，应优先修改仓库文件，再重新构建前端镜像。

## 架构说明

- **Nginx**: 入口网关，负责静态资源托管、`/api` 反代、`/ws` WebSocket 升级转发、`/assets` 强缓存、`500M` 上传上限与安全响应头/CSP。
- **Bun Backend**: 模型调度、AI 服务编排、FFmpeg 合成。
- **Redis**: 内网任务与状态缓存。

## 端口与暴露策略

- 仅前端网关暴露 `18081` 端口。
- Backend/Redis 使用容器内网 `expose`，不直接对宿主机暴露。

## 关键环境变量

| Key                                  | Default                    | Note                                                      |
| ------------------------------------ | -------------------------- | --------------------------------------------------------- |
| `PORT`                               | 33117                      | 后端端口                                                  |
| `REDIS_PASSWORD`                     | (required)                 | Redis `requirepass` 口令，生产环境必填且必须为强口令      |
| `UPLOADS_PATH`                       | `/app/uploads`             | 导出与上传统一根目录                                      |
| `VEOMUSE_DB_PATH`                    | `/app/data/veomuse.sqlite` | 本地 SQLite 存储路径（模型超市、创意闭环、协作审计）      |
| `DB_AUTO_REPAIR`                     | `true`                     | 启动时发现 SQLite 损坏自动尝试修复（`false` 时关闭）      |
| `DB_HEALTHCHECK_INTERVAL_MS`         | `0`                        | 运行时数据库健康巡检间隔（毫秒），`0` 表示关闭巡检        |
| `JWT_SECRET`                         | (empty)                    | 生产环境必填，未配置将拒绝启动                            |
| `SECRET_ENCRYPTION_KEY`              | (empty)                    | 生产环境必填，用于渠道密钥加密                            |
| `ADMIN_TOKEN`                        | (empty)                    | 建议必填，配置后 `/api/admin/metrics` 需 `x-admin-token`  |
| `ALCHEMY_API_URL`                    | (empty)                    | 风格迁移服务地址（启用 `/api/ai/alchemy/style-transfer`） |
| `ALCHEMY_API_KEY`                    | (empty)                    | 风格迁移服务密钥                                          |
| `CLEANUP_INTERVAL_MS`                | `86400000`                 | 自动清理任务调度间隔（毫秒）                              |
| `CLEANUP_RETENTION_MS`               | `86400000`                 | 文件保留时长（毫秒），超时自动删除                        |
| `SLO_CLEANUP_INTERVAL_MS`            | `86400000`                 | SLO 指标清理调度间隔（毫秒）                              |
| `SLO_REQUEST_RETENTION_DAYS`         | `14`                       | 请求级 SLO 指标保留天数                                   |
| `SLO_JOURNEY_RETENTION_DAYS`         | `30`                       | 旅程级 SLO 指标保留天数                                   |
| `SLO_TARGET_PRIMARY_SUCCESS_RATE`    | `0.995`                    | 主链路成功率目标                                          |
| `SLO_TARGET_NON_AI_P95_MS`           | `400`                      | 非 AI API P95 目标（毫秒）                                |
| `SLO_TARGET_FIRST_SUCCESS_MAX_STEPS` | `8`                        | 首次成功平均步数目标上限                                  |
| `MARKETPLACE_METRIC_INTERVAL_MS`     | `300000`                   | 模型运行指标聚合入库间隔（毫秒）                          |
| `STORAGE_PROVIDER`                   | `local`                    | 当前仅 `local` 生效，其他 provider 仍为预留扩展           |
| `LOCAL_STORAGE_ROOT`                 | `/app/uploads/workspace`   | 本地对象存储根目录                                        |
| `FEATURE_MODEL_POLICY_V2`            | `true`                     | 兼容性环境变量；当前实现默认开启，暂未作为运行时动态开关  |
| `FEATURE_CREATIVE_LOOP_V2`           | `true`                     | 兼容性环境变量；当前实现默认开启，暂未作为运行时动态开关  |
| `FEATURE_COLLAB_WS`                  | `true`                     | 兼容性环境变量；当前实现默认开启，暂未作为运行时动态开关  |
| `NODE_ENV`                           | production                 | 生产模式                                                  |

## 数据持久化

- `docker-compose.yml` 当前使用命名卷 `veomuse-data:/app/data` 持久化 SQLite 数据目录。
- `docker-compose.yml` 同时使用命名卷 `veomuse-uploads:/app/uploads` 持久化上传与导出产物。
- 若需改为宿主机 bind mount，可在 `docker-compose.yml` 将上述卷改写为目录映射，并同步 `VEOMUSE_DB_PATH` 与 `UPLOADS_PATH`。

## Docker Smoke 检查

本地可通过统一脚本执行 Docker 烟测（自动 `up --wait`、探测、失败诊断、清理）：

交付/验收口径的完整运行手册见：`docs/DOCKER_DELIVERY_RUNBOOK.md`。

```bash
# 默认 smoke（包含 --build）
bun run docker:smoke

# 跳过镜像重建并放宽等待时长
bun run docker:smoke -- --no-build --wait-timeout 240

# 调试时保留容器
bun run docker:smoke -- --keep-up
```

- 默认探测基础地址：`http://127.0.0.1:18081`。
- 当前脚本覆盖：`redis/backend/frontend` 健康态、`GET /`、`/api/health`、`/api/capabilities`、`/ws/generation`、安全响应头、`/assets` 强缓存、可选管理员只读探针。
- 失败时会自动输出 `docker compose ps` 与最近 `200` 行日志。
- 默认执行 `docker compose down --volumes --remove-orphans` 回收环境，可用 `--keep-up` 跳过。

### 最近一次本地正式复核

- 最近一次本地正式复核已于 `2026-03-08` 执行完成。
- 留痕记录：`docs/DOCKER_ACCEPTANCE_2026-03-09.md`
- 结论：本地 Compose 基线通过，`redis/backend/frontend` 全部 `healthy`，首页/API/WebSocket/安全头/静态缓存均已验证。
- 补充：`2026-03-09` 已完成 `format:check/lint/quality:api-contract/test/release:gate/docker:smoke/docker:ui-smoke/acceptance:deploy` 本地闭环复验，见 `docs/LOCAL_CLOSURE_2026-03-09.md`。
- 说明：该记录确认的是本地闭环通过；真实外部环境与真实凭据链路保留为后续增强验收。

## 验证命令

执行前请先确认：

- Docker Compose 可用。
- `.env` 已完成最小运行配置。
- Docker Compose 服务可正常拉起为 `healthy`。

```bash
curl -I http://127.0.0.1:18081
curl -s http://127.0.0.1:18081 | head -n 5
curl -s http://127.0.0.1:18081/api/health
curl -s http://127.0.0.1:18081/api/capabilities

STAMP=$(date +%s)
SMOKE_PASSWORD="Vm${STAMP}Ab#9"
SESSION_JSON=$(curl -s http://127.0.0.1:18081/api/auth/register \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"smoke-${STAMP}@veomuse.local\",\"password\":\"${SMOKE_PASSWORD}\",\"organizationName\":\"SmokeOrg-${STAMP}\"}")
ACCESS_TOKEN=$(echo "$SESSION_JSON" | jq -r '.session.accessToken')
ORG_ID=$(echo "$SESSION_JSON" | jq -r '.organizations[0].id')

curl -s http://127.0.0.1:18081/api/models/marketplace | jq '.models | length'
curl -s http://127.0.0.1:18081/api/models/policies \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" | jq '.policies | length'

WS_JSON=$(curl -s http://127.0.0.1:18081/api/workspaces \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -d "{\"name\":\"smoke-ws-${STAMP}\",\"ownerName\":\"OwnerSmoke\",\"organizationId\":\"${ORG_ID}\"}")
WORKSPACE_ID=$(echo "$WS_JSON" | jq -r '.workspace.id')
PROJECT_ID=$(echo "$WS_JSON" | jq -r '.defaultProject.id')

TOKEN_JSON=$(curl -s http://127.0.0.1:18081/api/storage/upload-token \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-organization-id: ${ORG_ID}" \
  -d "{\"workspaceId\":\"${WORKSPACE_ID}\",\"projectId\":\"${PROJECT_ID}\",\"fileName\":\"demo.mp4\"}")
echo "$TOKEN_JSON" | jq '.token.provider, .token.objectKey'
UPLOAD_URL=$(echo "$TOKEN_JSON" | jq -r '.token.uploadUrl')

curl -s "http://127.0.0.1:18081${UPLOAD_URL}" \
  -X PUT \
  -H 'Content-Type: application/octet-stream' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-binary 'demo' | jq '.uploaded.bytes'

curl -s http://127.0.0.1:18081/api/admin/db/health -H "x-admin-token: $ADMIN_TOKEN" | jq '.health.status'
curl -s http://127.0.0.1:18081/api/admin/db/runtime -H "x-admin-token: $ADMIN_TOKEN" | jq '.runtime'
curl -s http://127.0.0.1:18081/api/admin/providers/health -H "x-admin-token: $ADMIN_TOKEN" | jq '.summary'
curl -s http://127.0.0.1:18081/api/admin/slo/summary -H "x-admin-token: $ADMIN_TOKEN" | jq '.summary.passFlags'
curl -s "http://127.0.0.1:18081/api/admin/slo/breakdown?category=non_ai&limit=5" -H "x-admin-token: $ADMIN_TOKEN" | jq '.breakdown.items'
curl -I http://127.0.0.1:18081 | grep -E "Content-Security-Policy|X-Frame-Options|Referrer-Policy|Permissions-Policy"
curl -s http://127.0.0.1:18081/api/admin/metrics -H "x-admin-token: $ADMIN_TOKEN" | jq '.api["System-Cleanup"]'

# WebSocket 握手（期望返回 101）
curl -i \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: SGVsbG9WZW9NdXNl' \
  -H 'Sec-WebSocket-Version: 13' \
  http://127.0.0.1:18081/ws/generation
```

## 发布门禁

```bash
# 标准发布门禁（本地标准回归 + SLO）
bun run release:gate

# 正式部署环境验收（在目标主机本地执行，非侵入探测）
bun run acceptance:deploy -- --base-url http://127.0.0.1:18081

# 真实凭据预检（需显式设置 `E2E_REAL_CHANNELS=true` 与必需 Provider 凭据）
bun run release:real:precheck

# 实网回归留痕入口（面向已部署实例执行外部 @real Playwright）
E2E_REAL_CHANNELS=true bun run acceptance:real -- --base-url https://veomuse.example.com --api-base-url https://api.veomuse.example.com

# 含真实渠道回归（需要真实 AI 凭据，real 用例若全部 skipped 将直接失败）
bun run release:gate:real
```

### 外部增强验收入口

- `acceptance:deploy`
  - 用途：在目标正式部署环境主机本地做协议级只读验收；若存在管理员令牌，会额外校验 `/api/admin/metrics`。
  - 输出：`artifacts/deploy-acceptance/<timestamp>/summary.json`、`summary.md`
  - 默认不执行 `docker compose up/down`、不重启服务、不跑浏览器 UI smoke。
- `acceptance:real`
  - 用途：统一执行真实凭据预检、部署实例就绪探测与外部 `@real` Playwright 回归，并生成留痕。
  - 输出：`artifacts/real-acceptance/<timestamp>/summary.json`、`summary.md`、`playwright.stdout.log`、`playwright.stderr.log`

工程质量补充命令：

```bash
# 统一格式检查
bun run format:check

# 覆盖率门禁（产出 coverage/lcov.info 与 summary.json）
bun run test:coverage

# 全链路质量入口
bun run quality:full
```

API 契约门禁（V4）：

- 目标：保证路由实现、API 文档、`_api.test.ts` 测试三方一致。
- 执行命令（本地/CI 都可）：

```bash
bun run quality:api-contract
```

- 非 0 退出表示存在契约缺口，输出 JSON 中 `failures[]` 会标记缺失维度（`route` / `documentation` / `tests`）。
- 可选参数：
  - `--backend` 指定后端路由文件
  - `--docs` 指定 API 文档
  - `--tests-dir` 指定测试目录

```bash
bun run quality:api-contract:generate
bun run scripts/api_contract_guard.ts \
  --backend apps/backend/src/index.ts \
  --docs docs/API_DOCUMENTATION.md \
  --tests-dir tests
```

SLO 门禁说明：

- CI 主门禁统一由 `release:gate` 驱动，默认链路为 `security + build + unit + e2e smoke + e2e regression + SLO`。
- `release:gate` 默认策略：本地执行默认 `soft`；CI 环境按分支选择 `main=hard`、其他分支=`soft`。
- `soft`：仅告警，不阻断发布；`hard`：任何未达标将阻断发布。
- 报告输出默认路径：`artifacts/slo-report.json`。
- 质量汇总输出：`artifacts/quality-summary.json`，失败步骤新增 `steps[].failure.domain`（`security/build/test/e2e/slo/unknown`）。
- 质量汇总新增 `recommendations` 字段：输出中文可执行修复动作，并按失败域自动去重。
- 质量汇总中 `videoGenerateLoop` 追踪标准回归闭环；`realE2E` 追踪实网回归，失败时会按 `auth/quota/timeout/upstream_5xx/unknown` 输出 `failureType`，便于快速分流。
- 本地执行 `release:gate` 时会在 SLO 检查前自动探测 `/api/health`；若 SLO API 不可达且地址为本机（`127.0.0.1/localhost/0.0.0.0`），会自动拉起后端并在结束后回收。
- 仍兼容历史开关 `SLO_GATE_ENFORCE=true`，等价于 `mode=hard`。
- 若需手动覆盖模式，请在执行前设置：

```bash
RELEASE_SLO_MODE=soft bun run release:gate
```

可选参数与环境变量：

- `SLO_GATE_API_BASE` / `API_BASE_URL` / `--api-base`：SLO 拉取地址（默认 `http://127.0.0.1:33117`）
- `SLO_GATE_MODE` / `--mode`：门禁模式（`soft`/`hard`）
- `SLO_GATE_WINDOW_MINUTES` / `--window`：统计窗口（默认 `1440`）
- `SLO_GATE_CATEGORY` / `--category`：分解维度（默认 `non_ai`）
- `SLO_GATE_LIMIT` / `--limit`：分解条数（默认 `8`）
- `SLO_GATE_MIN_NON_AI_SAMPLES` / `--min-non-ai-samples`：非 AI 最小样本阈值（默认 `20`）
- `SLO_GATE_MIN_JOURNEY_SAMPLES` / `--min-journey-samples`：旅程最小样本阈值（默认 `10`）
- `SLO_GATE_MIN_FRONTEND_SOURCE_RATIO` / `--min-frontend-source-ratio`：来源占比最小阈值（默认 `0`，表示关闭；建议取值 `0~1`）
- `SLO_GATE_FRONTEND_SOURCE_KEY` / `--frontend-source-key`：来源占比统计键（默认 `frontend`，从 `summary.sourceBreakdown` 读取）
- `SLO_GATE_REPORT_SCHEMA_VERSION` / `--schema-version`：报告 schema 版本号（默认 `1.0`）
- `SLO_GATE_ADMIN_TOKEN`：可覆盖 `ADMIN_TOKEN` 用于脚本鉴权
- `SLO_ADMIN_SEED_ENABLED`：是否启用 `/api/admin/slo/seed` 预热接口（默认 `false`，建议仅 CI 临时开启）
- `RELEASE_GATE_SLO_BOOTSTRAP`：是否启用本地 SLO 自举（默认本地 `true`、CI `false`）
- `RELEASE_GATE_SLO_BOOTSTRAP_TIMEOUT_MS`：本地自举超时（默认 `15000`）
- `RELEASE_GATE_SLO_HEALTH_TIMEOUT_MS`：单次健康探测超时（默认 `1200`）
- `RELEASE_GATE_SLO_RETRIES` / `--slo-retries`：SLO Check 重试次数（默认 `1`，即失败后至少再试一次）
- 地址优先级：`--api-base` > `SLO_GATE_API_BASE` > `API_BASE_URL` > 默认地址

样本不足策略：

- 当样本低于阈值时，报告会在 `sampleChecks` 与 `failedRules` 明确标记不足项。
- `soft` 模式返回 `warn`；`hard` 模式返回 `fail` 并阻断流水线。
- 默认阈值为 `non_ai>=20`、`journey>=10`、`frontend_source_ratio=0(关闭)`；如需临时放宽，可显式设为 `0`。
- `slo-report.json` 除 `summary/breakdown` 外，还会输出 `journeyFailures`（失败阶段+错误类型聚合）用于定位主链路失败模式。

CI 质量门禁策略（`.github/workflows/ci-quality-gate.yml`）：

- CI 主门禁检查集合与 `release:gate` 保持一致，差异仅在执行编排与 SLO 模式（PR=`soft`、`main`=`hard`）。
- PR：`soft` 模式执行 SLO 门禁。
- `main`：`hard` 模式执行 SLO 门禁。
- SLO 检查前会调用 `/api/admin/slo/seed` 预热 `20/10` 样本（仅 CI 开启 `SLO_ADMIN_SEED_ENABLED=true`）。
- 产物统一上传：`playwright-report/`、`test-results/playwright/`、`artifacts/slo-report.json`、`artifacts/slo-seed.json`。
- Docker smoke 由独立 job `docker-smoke-main` 执行，且仅在 `main push` 触发，避免拖慢 PR 流水线。

真实渠道回归启用条件：

- `E2E_REAL_CHANNELS=true`
- `GEMINI_API_KEYS` 已配置（用于真实导演生成链路）
- 建议先执行 `bun run release:real:precheck`，确认必需凭据已就绪再进入 real 回归
- `bun run release:real:precheck` 会默认注入 `E2E_REAL_CHANNELS=true`，并检查 real 用例所需的 Provider 凭据；直接手工运行 `e2e:regression:real` 时仍需显式设置 `E2E_REAL_CHANNELS=true`。
- 当前仓库的 `@real` 回归默认要求已配置 `E2E_REAL_CHANNELS=true` 与 `GEMINI_API_KEYS`；如后续 real 用例扩展到更多 provider，可通过 `E2E_REAL_REQUIRED_ENV_KEYS=OPENAI_API_KEY,OPENAI_BASE_URL` 这类环境变量追加预检键。
- 门禁启动阶段会先做 real 回归凭据预检；缺少必需变量会快速失败并输出缺失项。
- `release:gate:real` 会校验 real 用例执行结果；若 `passed/failed/flaky/timed out/interrupted` 全为 0（即全部 skipped），门禁判定失败。
- 真实渠道回归默认仍为手动执行（本地命令或手动 workflow），不纳入 PR/main 自动流水线。

手动 workflow 入口（按需执行）：

```bash
# 真实渠道回归（手动）
bun run release:real:precheck
E2E_REAL_CHANNELS=true bun run e2e:regression:real
# 或完整门禁 + 真实回归
bun run release:gate:real

# DB repair drill（手动）
bun run drill:db-repair

# 协作 WS stress（手动）
bun run stress:collab-ws
```

触发条件与产物：

- 真实回归：适用于真实渠道配置、供应商策略、凭据变更等高风险发布前复核；产物位于 `playwright-report/`、`test-results/playwright/`。
- DB repair drill：适用于数据库修复逻辑调整、SQLite 升级、损坏告警演练；产物位于 `data/drills/`，核心报告为 `db-repair-drill-*.json`（含 `backupPath`、`quarantinePath`、`copiedRows`）。
- stress：适用于协作协议/广播路径改动与容量基线复测；产物为脚本标准输出 JSON 摘要（`ackRate`、`avgAckMs`、`p95AckMs`、`errors`、`broadcasts`）。

## Secrets 防泄漏

```bash
# 安装本地 pre-push 钩子（提交前自动扫描）
bun run hooks:install

# 全仓扫描（轻量）
bun run security:scan
```

CI 已内置双层扫描：

- `Bun Secrets Guard`（轻量正则）
- `Gitleaks Deep Scan`（历史级深度扫描 + SARIF）

## 协作鉴权要求

- 所有工作区接口统一使用 `Authorization: Bearer <accessToken>`，并以真实工作区成员角色做鉴权（`viewer/editor/owner`）。
- 邀请与成员管理接口要求 `owner` 角色；上传令牌与本地上传要求至少 `editor` 角色。
- WebSocket 协作通道推荐携带 `veomuse-auth.<accessToken>` 子协议；服务端兼容 `Authorization: Bearer <accessToken>`。仅允许已加入工作区的成员连接，非成员会被立即断开。

## 协作 WS 压测脚本

默认对运行中的后端执行协作通道压测（创建工作区 -> 多客户端并发连接 -> timeline/cursor/heartbeat ACK 统计）。

```bash
# 对当前后端压测（默认 12 客户端 x 10 轮）
bun run stress:collab-ws

# 预设短压（8 客户端 x 6 轮）/ 长压（24 客户端 x 48 轮）
COLLAB_STRESS_PROFILE=short bun run stress:collab-ws
COLLAB_STRESS_PROFILE=long bun run stress:collab-ws

# 自启动后端压测（脚本内部临时监听随机端口）
SELF_HOST=1 bun run stress:collab-ws

# 自定义规模
COLLAB_STRESS_CLIENTS=24 COLLAB_STRESS_ROUNDS=20 bun run stress:collab-ws

# 自定义 JSON 报告路径（默认 artifacts/collab-ws-stress-summary.json）
COLLAB_STRESS_OUTPUT=artifacts/collab-ws-longrun.json bun run stress:collab-ws
```

返回摘要包括：`ackRate`、`avgAckMs`、`p95AckMs`、`errors`、`broadcasts`。  
当 `ackRate < 0.99` 或存在 `errors` 时，脚本将以非 0 状态退出。
同时会写入 JSON 报告文件，便于 CI 归档与对比基线。

说明：未显式配置 `API_BASE_URL` 时，脚本会自动优先探测 `http://127.0.0.1:18081`（Docker 网关）并回退到 `http://127.0.0.1:33117`（直连后端）。

---
