# VeoMuse 部署指南

部署相关长期入口如下：

- 工程工作流：`docs/ENGINEERING_WORKFLOW.md`
- 发布检查清单：`docs/RELEASE_CHECKLIST.md`
- Docker 交付与清理手册：`docs/DOCKER_DELIVERY_RUNBOOK.md`

## 一键部署

```bash
bash scripts/one-click-deploy.sh
```

Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/one-click-deploy.ps1
```

## 手动部署

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose -f config/docker/docker-compose.yml ps
```

## 服务与端口

- 网关地址：`http://127.0.0.1:18081`
- 后端健康检查：`http://127.0.0.1:18081/api/health`
- 对外暴露端口：`18081`
- 内部服务：`redis`、`backend`、`frontend`

## 核心环境变量

| Key                     | Default                    | Note             |
| ----------------------- | -------------------------- | ---------------- |
| `PORT`                  | `33117`                    | 后端端口         |
| `REDIS_PASSWORD`        | required                   | Redis 口令       |
| `UPLOADS_PATH`          | `/app/uploads`             | 上传与导出根目录 |
| `VEOMUSE_DB_PATH`       | `/app/data/veomuse.sqlite` | SQLite 数据路径  |
| `JWT_SECRET`            | empty                      | 生产环境必填     |
| `SECRET_ENCRYPTION_KEY` | empty                      | 生产环境必填     |
| `ADMIN_TOKEN`           | empty                      | 管理接口鉴权     |

## Docker 验证

协议级验收：

```bash
bun run docker:smoke -- --wait-timeout 240
```

浏览器链路验收：

```bash
bun run docker:ui-smoke
```

正式部署环境只读验收：

```bash
bun run acceptance:deploy -- --base-url http://127.0.0.1:18081
E2E_REAL_CHANNELS=true bun run acceptance:real -- --base-url https://veomuse.example.com --api-base-url https://api.veomuse.example.com
```

验收产物：

- `artifacts/deploy-acceptance/<timestamp>/summary.json`
- `artifacts/real-acceptance/<timestamp>/summary.json`

## 清理与重置

```bash
bun run docker:reset
bun run docker:reset:volumes
bun run clean
```

## 注意事项

- `docker:smoke` 用于镜像与协议链路检查。
- `docker:ui-smoke` 用于真实 Docker 页面浏览器交互检查。
- `acceptance:deploy` 和 `acceptance:real` 负责部署态留痕，不替代标准发布门禁。
