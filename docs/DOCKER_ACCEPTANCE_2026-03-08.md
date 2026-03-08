# VeoMuse Docker 正式复核记录（2026-03-08）

本记录用于留存本地 Docker Compose 在最新镜像构建完成后的正式复核结果。
本次复核包含真实 `--build` 路径、浏览器级 Docker UI smoke 与持久化 drill。
本次复核不包含真实 Provider 凭据链路，也不代表 `release:gate:real` 已完成。
当前仓库的“本地闭环结项”总结见：`docs/LOCAL_CLOSURE_2026-03-08.md`。

## 复核环境

- 日期：`2026-03-08`
- 入口地址：`http://127.0.0.1:18081`
- Compose 文件：`config/docker/docker-compose.yml`
- 执行口径：本地正式复核，先保留容器完成 UI / persistence 验收，最后执行环境清理

## 执行命令

```bash
bun run docker:smoke -- --wait-timeout 240 --keep-up
bun run docker:ui-smoke
bun run docker:drill:persistence -- --wait-timeout 240 --no-build --keep-up
bun run docker:reset
```

## 结果摘要

### 构建与启动

- `docker:smoke` 已在真实 `--build` 路径下通过
- `backend/frontend` 镜像均已基于最新 Dockerfile 重建成功
- `redis/backend/frontend` 在重建后全部达到 `healthy`

### 自动化 smoke 覆盖结果

以下项目已通过：

- `GET /`
- `GET /api/health`
- `GET /api/capabilities`
- `/ws/generation` WebSocket 握手
- 安全响应头
- `/assets/*` 强缓存
- 前端实验室入口 bundle 标识
- 前端系统监控入口 bundle 标识
- `redis/backend/frontend` 健康态

### Docker UI smoke 结果

以下浏览器级链路已通过：

- 注册并创建组织
- 创建工作区
- ComparisonLab 可见
- 系统监控 command bar / Provider / 数据库区块可见
- Channel panel 可打开

### Docker 持久化 drill 结果

以下重启恢复链路已通过：

- 注册组织并创建工作区
- 创建项目快照
- 上传文件到本地对象存储
- `restart veomuse-backend veomuse-frontend`
- 重启后 `/api/health` 仍通过
- 重启后登录、工作区项目、成员、项目快照仍可读取
- 重启后容器内上传文件仍存在且字节数一致

Drill Summary 关键字段：

- `workspaceId=ws_afdab98b-2c0b-4dfe-bdc9-999723286aca`
- `projectId=prj_6e6de435-ce19-4766-b2e7-fa6f249ca3ac`
- `snapshotId=snap_c46615ac-b559-4ec6-b538-455580a666aa`
- `uploadBytes=205`

## 本次额外结论

- 之前 Docker 构建体感“卡在 bun install”的问题已定位并修复：
  - backend 镜像只安装 `@veomuse/backend` 生产依赖
  - frontend builder 只安装 `@veomuse/frontend` workspace 依赖
  - Bun install cache mount 已启用
- 修复后，真实 `docker:smoke --build` 已重新跑通，不再需要依赖旧镜像做 `--no-build` 验证

## 未包含项

- 未执行真实 Provider 凭据链路
- 未执行 `release:gate:real`
- 未在外部正式部署环境主机上重复留痕
- 未把 Docker persistence drill 并入 PR 主门禁

## 结论

截至 `2026-03-08`，本地 Docker 交付基线已完成一轮完整正式复核，当前可判定：

- 最新镜像真实构建可通过
- 协议级 smoke 可通过
- 浏览器级 Docker UI smoke 可通过
- 重启后持久化链路可通过
- 本地交付、回归与验收口径已经闭环
- 如需外部生产环境背书，可在后续单独补做目标环境留痕与真实凭据回归
