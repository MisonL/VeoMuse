# VeoMuse 旗舰版生产部署指南 (V3.1 Pro)

## 🚀 一键部署 (Recommended)

系统已完全容器化，前端镜像会在构建阶段自动执行前端构建（无需宿主机预先生成 `dist`）。
V3.1 正式发版支持三大平台一键安装部署：

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
- 自动等待 `http://127.0.0.1:18081/api/health` 健康检查通过。

### 一键脚本参数
- `--force-env` / `-ForceEnv`：强制重建关键安全变量（会备份旧 `.env`）。
- `--skip-build` / `-SkipBuild`：跳过镜像重建，直接 `up -d`。
- `--api-port <port>` / `-ApiPort <port>`：自定义健康检查端口。

## 🏗️ 架构详情
- **Nginx**: 入口网关，负责静态资源托管、`/api` 反代与 `/ws` WebSocket 转发。
- **Bun Backend**: 模型调度、AI 服务编排、FFmpeg 合成。
- **Redis**: 内网任务与状态缓存。

## 🔐 暴露策略
- 仅前端网关暴露 `18081` 端口。
- Backend/Redis 使用容器内网 `expose`，不直接对宿主机暴露。

## ⚙️ 关键环境变量
| Key | Default | Note |
|---|---|---|
| `PORT` | 33117 | 后端端口 |
| `REDIS_PASSWORD` | (required) | Redis `requirepass` 口令，生产环境必填且必须为强口令 |
| `UPLOADS_PATH` | `/app/uploads` | 导出与上传统一根目录 |
| `VEOMUSE_DB_PATH` | `/app/data/veomuse.sqlite` | 本地 SQLite 存储路径（模型超市、创意闭环、协作审计） |
| `DB_AUTO_REPAIR` | `true` | 启动时发现 SQLite 损坏自动尝试修复（`false` 时关闭） |
| `DB_HEALTHCHECK_INTERVAL_MS` | `0` | 运行时数据库健康巡检间隔（毫秒），`0` 表示关闭巡检 |
| `JWT_SECRET` | (empty) | 生产环境必填，未配置将拒绝启动 |
| `SECRET_ENCRYPTION_KEY` | (empty) | 生产环境必填，用于渠道密钥加密 |
| `ADMIN_TOKEN` | (empty) | 建议必填，配置后 `/api/admin/metrics` 需 `x-admin-token` |
| `ALCHEMY_API_URL` | (empty) | 风格迁移服务地址（启用 `/api/ai/alchemy/style-transfer`） |
| `ALCHEMY_API_KEY` | (empty) | 风格迁移服务密钥 |
| `CLEANUP_INTERVAL_MS` | `86400000` | 自动清理任务调度间隔（毫秒） |
| `CLEANUP_RETENTION_MS` | `86400000` | 文件保留时长（毫秒），超时自动删除 |
| `SLO_CLEANUP_INTERVAL_MS` | `86400000` | SLO 指标清理调度间隔（毫秒） |
| `SLO_REQUEST_RETENTION_DAYS` | `14` | 请求级 SLO 指标保留天数 |
| `SLO_JOURNEY_RETENTION_DAYS` | `30` | 旅程级 SLO 指标保留天数 |
| `SLO_TARGET_PRIMARY_SUCCESS_RATE` | `0.995` | 主链路成功率目标 |
| `SLO_TARGET_NON_AI_P95_MS` | `400` | 非 AI API P95 目标（毫秒） |
| `SLO_TARGET_FIRST_SUCCESS_MAX_STEPS` | `8` | 首次成功平均步数目标上限 |
| `MARKETPLACE_METRIC_INTERVAL_MS` | `300000` | 模型运行指标聚合入库间隔（毫秒） |
| `STORAGE_PROVIDER` | `local` | 上传令牌 provider，当前推荐 `local`（已预留云兼容接口） |
| `LOCAL_STORAGE_ROOT` | `/app/uploads/workspace` | 本地对象存储根目录 |
| `FEATURE_MODEL_POLICY_V2` | `true` | 模型策略治理增强能力开关 |
| `FEATURE_CREATIVE_LOOP_V2` | `true` | 创意闭环版本化能力开关 |
| `FEATURE_COLLAB_WS` | `true` | 实时协同 WebSocket 开关 |
| `NODE_ENV` | production | 生产模式 |

## 🗄️ 数据持久化
- `docker-compose.yml` 已将后端 SQLite 数据目录挂载为 `../../data:/app/data`。
- 若需要自定义路径，请同时修改 `VEOMUSE_DB_PATH` 与 volume 挂载目标，保持路径一致。

## ✅ 验证命令
```bash
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
curl -s http://127.0.0.1:18081/api/admin/slo/summary -H "x-admin-token: $ADMIN_TOKEN" | jq '.summary.passFlags'
curl -s "http://127.0.0.1:18081/api/admin/slo/breakdown?category=non_ai&limit=5" -H "x-admin-token: $ADMIN_TOKEN" | jq '.breakdown.items'
curl -I http://127.0.0.1:18081 | grep -E "Content-Security-Policy|X-Frame-Options|Referrer-Policy|Permissions-Policy"
curl -s http://127.0.0.1:18081/api/admin/metrics -H "x-admin-token: $ADMIN_TOKEN" | jq '.api["System-Cleanup"]'
```

## 🚦 发布门禁
```bash
# 标准发布门禁（默认包含稳定 Mock 回归）
bun run release:gate

# 含真实渠道回归（需要真实 AI 凭据）
bun run release:gate:real
```

SLO 门禁说明：
- `release:gate` 默认执行 `SLO Check (soft)`，仅生成报告并告警，不阻断发布。
- 报告输出默认路径：`artifacts/slo-report.json`。
- 若需硬门禁，请在执行前设置：

```bash
SLO_GATE_ENFORCE=true bun run release:gate
```

可选参数与环境变量：
- `API_BASE_URL` / `--api-base`：SLO 拉取地址（默认 `http://127.0.0.1:18081`）
- `SLO_GATE_WINDOW_MINUTES` / `--window`：统计窗口（默认 `1440`）
- `SLO_GATE_CATEGORY` / `--category`：分解维度（默认 `non_ai`）
- `SLO_GATE_LIMIT` / `--limit`：分解条数（默认 `8`）
- `SLO_GATE_ADMIN_TOKEN`：可覆盖 `ADMIN_TOKEN` 用于脚本鉴权

真实渠道回归启用条件：
- `E2E_REAL_CHANNELS=true`
- `GEMINI_API_KEYS` 已配置（用于真实导演生成链路）

## 🛡️ Secrets 防泄漏
```bash
# 安装本地 pre-push 钩子（提交前自动扫描）
bun run hooks:install

# 全仓扫描（轻量）
bun run security:scan
```

CI 已内置双层扫描：
- `Bun Secrets Guard`（轻量正则）
- `Gitleaks Deep Scan`（历史级深度扫描 + SARIF）

## 🔒 协作鉴权要求
- 所有工作区接口统一使用 `Authorization: Bearer <accessToken>`，并以真实工作区成员角色做鉴权（`viewer/editor/owner`）。
- 邀请与成员管理接口要求 `owner` 角色；上传令牌与本地上传要求至少 `editor` 角色。
- WebSocket 协作通道推荐携带 `veomuse-auth.<accessToken>` 子协议；服务端兼容 `Authorization: Bearer <accessToken>`。仅允许已加入工作区的成员连接，非成员会被立即断开。

## 🧪 协作 WS 压测脚本
默认对运行中的后端执行协作通道压测（创建工作区 -> 多客户端并发连接 -> timeline/cursor/heartbeat ACK 统计）。

```bash
# 对当前后端压测（默认 12 客户端 x 10 轮）
bun run stress:collab-ws

# 自启动后端压测（脚本内部临时监听随机端口）
SELF_HOST=1 bun run stress:collab-ws

# 自定义规模
COLLAB_STRESS_CLIENTS=24 COLLAB_STRESS_ROUNDS=20 bun run stress:collab-ws
```

返回摘要包括：`ackRate`、`avgAckMs`、`p95AckMs`、`errors`、`broadcasts`。  
当 `ackRate < 0.99` 或存在 `errors` 时，脚本将以非 0 状态退出。

说明：未显式配置 `API_BASE_URL` 时，脚本会自动优先探测 `http://127.0.0.1:18081`（Docker 网关）并回退到 `http://127.0.0.1:33117`（直连后端）。

---
**VeoMuse - 工业级稳定性，旗舰级表现。**
