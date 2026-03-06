# VeoMuse Docker 正式复核记录（2026-03-07）

本记录用于留存本地 Docker Compose 作为正式交付基线的实际复核结果。
本次复核不包含真实 Provider 凭据链路，也不代表 `release:gate:real` 已完成。

## 复核环境

- 日期：`2026-03-07`
- 入口地址：`http://127.0.0.1:18081`
- Compose 文件：`config/docker/docker-compose.yml`
- 执行口径：本地正式复核，保留容器用于人工补验

## 执行命令

```bash
bun run docker:smoke -- --wait-timeout 240 --keep-up
docker compose -f config/docker/docker-compose.yml ps
curl -I http://127.0.0.1:18081
curl -s http://127.0.0.1:18081/api/health
curl -s http://127.0.0.1:18081/api/capabilities
curl -s http://127.0.0.1:18081/api/admin/db/health -H "x-admin-token: $ADMIN_TOKEN"
curl -s http://127.0.0.1:18081/api/admin/providers/health -H "x-admin-token: $ADMIN_TOKEN"
curl -s http://127.0.0.1:18081/api/admin/slo/summary -H "x-admin-token: $ADMIN_TOKEN"
```

## 结果摘要

### 容器健康态

- `veomuse-redis`：`healthy`
- `veomuse-backend`：`healthy`
- `veomuse-frontend`：`healthy`

### 自动化 smoke 覆盖结果

以下项目已通过：

- `GET /`
- `GET /api/health`
- `GET /api/capabilities`
- `/ws/generation` WebSocket 握手
- 注册 -> 工作区 -> 上传令牌 -> 本地上传链路
- 安全响应头
- `/assets/*` 强缓存
- `redis/backend/frontend` 健康态

### 人工补验结果

- 首页 `HTTP 200`
- `/api/health` 返回 `{\"status\":\"ok\"}`
- `/api/capabilities` 返回基础能力结构，当前无真实 Provider 凭据时模型能力为 `false`，平台能力仍可用
- `/api/admin/db/health` 返回 `health.status=ok`
- `/api/admin/providers/health` 返回成功结构
- `/api/admin/slo/summary` 返回成功结构

## 未包含项

- 未执行真实 Provider 凭据链路
- 未执行 `release:gate:real`
- 未在外部正式部署环境主机上重复留痕

## 结论

本地 Docker Compose 基线已完成一轮正式复核，当前可判定：

- 作为本地交付与回归基线，Docker 链路已可用
- 若要声明“可正式上线”，仍需：
  - 在目标正式部署环境执行同等复核并留痕
  - 配置真实凭据后完成 `release:gate:real`
