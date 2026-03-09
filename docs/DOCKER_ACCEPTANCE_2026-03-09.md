# VeoMuse Docker 正式复核记录（2026-03-09）

本记录用于留存本地 Docker Compose 在最新镜像构建完成后的再次正式复核结果。
本次复核包含真实 `--build` 路径、浏览器级 Docker UI smoke、部署协议级只读验收，以及与前端视觉收敛相关的回归修复确认。
本次复核不包含真实 Provider 凭据链路，也不代表 `release:gate:real` 已完成。
当前仓库的“本地闭环结项”总结见：`docs/LOCAL_CLOSURE_2026-03-09.md`。

## 复核环境

- 日期：`2026-03-09`
- 入口地址：`http://127.0.0.1:18081`
- Compose 文件：`config/docker/docker-compose.yml`
- 代码基线：`2026-03-09 当日主线收尾版本（含 ComparisonLab 视觉回归修复）`

## 执行命令

```bash
bun run docker:smoke -- --wait-timeout 240 --keep-up
bun run docker:ui-smoke
bun run acceptance:deploy -- --base-url http://127.0.0.1:18081
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
- Channel panel 可打开并完成关键登录注册流程

### 部署协议级只读验收结果

以下项目已通过：

- 首页探测
- `GET /api/health`
- `GET /api/capabilities`
- `/ws/generation` WebSocket 握手
- 管理员只读探针 `/api/admin/metrics`
- 留痕产物：`artifacts/deploy-acceptance/2026-03-09T01-45-42-587Z/summary.json`

## 本次额外结论

- `ComparisonLab` 最新视觉收敛过程中引入的两处回归已修复并通过 Docker 浏览器验证：
  - 渠道接入弹层现已以全局模态层覆盖，不再被右侧面板或底部时间轴拦截点击
  - 实验阶段 rail 与 creative hero 的响应式断点已重新收口，桌面常见宽度下不再出现点击遮挡与主区过窄问题
- 本地 Docker 交付基线仍保持可复现，不需要回退到旧视觉实现

## 未包含项

- 未执行真实 Provider 凭据链路
- 未执行 `release:gate:real`
- 未在外部正式部署环境主机上重复留痕

## 结论

截至 `2026-03-09`，本地 Docker 交付基线已再次完成正式复核，当前可判定：

- 最新镜像真实构建可通过
- 协议级 smoke 可通过
- 浏览器级 Docker UI smoke 可通过
- 部署协议级只读验收可通过
- 前端视觉收敛引入的 Docker 浏览器回归已修复

如需外部生产环境背书，可在后续单独补做目标环境留痕与真实凭据回归。
