# VeoMuse 旗舰版生产部署指南 (V3.1 Pro)

## 🚀 一键部署 (Recommended)

系统已完全容器化，前端镜像会在构建阶段自动执行前端构建（无需宿主机预先生成 `dist`）。

```bash
# 1. 填入环境变量（至少包含 Gemini Key）
cat > .env <<'ENV'
GEMINI_API_KEYS=key1,key2
# 可选：ADMIN_TOKEN=your_admin_token
ENV

# 2. 启动集群
cd config/docker
docker-compose up -d --build
```

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
| `UPLOADS_PATH` | `/app/uploads` | 导出与上传统一根目录 |
| `VEOMUSE_DB_PATH` | `/app/data/veomuse.sqlite` | 本地 SQLite 存储路径（模型超市、创意闭环、协作审计） |
| `DB_AUTO_REPAIR` | `true` | 启动时发现 SQLite 损坏自动尝试修复（`false` 时关闭） |
| `DB_HEALTHCHECK_INTERVAL_MS` | `0` | 运行时数据库健康巡检间隔（毫秒），`0` 表示关闭巡检 |
| `ADMIN_TOKEN` | (empty) | 配置后 `/api/admin/metrics` 需 `x-admin-token` |
| `ALCHEMY_API_URL` | (empty) | 风格迁移服务地址（启用 `/api/ai/alchemy/style-transfer`） |
| `ALCHEMY_API_KEY` | (empty) | 风格迁移服务密钥 |
| `CLEANUP_INTERVAL_MS` | `86400000` | 自动清理任务调度间隔（毫秒） |
| `CLEANUP_RETENTION_MS` | `86400000` | 文件保留时长（毫秒），超时自动删除 |
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
curl -s http://127.0.0.1:18081/api/models/marketplace | jq '.models | length'
curl -s http://127.0.0.1:18081/api/models/policies | jq '.policies | length'
WS_JSON=$(curl -s http://127.0.0.1:18081/api/workspaces -X POST -H 'Content-Type: application/json' -d '{"name":"smoke-ws","ownerName":"OwnerSmoke"}')
WORKSPACE_ID=$(echo "$WS_JSON" | jq -r '.workspace.id')
PROJECT_ID=$(echo "$WS_JSON" | jq -r '.defaultProject.id')
TOKEN_JSON=$(curl -s http://127.0.0.1:18081/api/storage/upload-token -X POST -H 'Content-Type: application/json' -H 'x-workspace-actor: OwnerSmoke' -d "{\"workspaceId\":\"${WORKSPACE_ID}\",\"projectId\":\"${PROJECT_ID}\",\"fileName\":\"demo.mp4\"}")
echo "$TOKEN_JSON" | jq '.token.provider, .token.objectKey'
UPLOAD_URL=$(echo "$TOKEN_JSON" | jq -r '.token.uploadUrl')
curl -s "http://127.0.0.1:18081${UPLOAD_URL}" -X PUT -H 'Content-Type: application/octet-stream' -H 'x-workspace-actor: OwnerSmoke' --data-binary 'demo' | jq '.uploaded.bytes'
curl -s http://127.0.0.1:18081/api/admin/db/health -H "x-admin-token: $ADMIN_TOKEN" | jq '.health.status'
curl -s http://127.0.0.1:18081/api/admin/db/runtime -H "x-admin-token: $ADMIN_TOKEN" | jq '.runtime'
curl -I http://127.0.0.1:18081 | grep -E "Content-Security-Policy|X-Frame-Options|Referrer-Policy|Permissions-Policy"
curl -s http://127.0.0.1:18081/api/admin/metrics -H "x-admin-token: $ADMIN_TOKEN" | jq '.api["System-Cleanup"]'
```

## 🔒 协作鉴权要求
- 工作区 Owner 级接口（邀请管理、成员管理）必须携带 `x-workspace-actor`，并且该成员在目标工作区中真实角色为 `owner`。
- WebSocket 协作通道只允许已加入工作区的成员连接；非成员会收到错误并断开。

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
