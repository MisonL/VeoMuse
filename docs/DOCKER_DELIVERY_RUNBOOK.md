# VeoMuse Docker 交付验收与清理手册

本手册用于结项后的 Docker 交付验收、问题排查与本地环境清理。
部署总入口见：`docs/DEPLOYMENT.md`。
发布前清单见：`docs/RELEASE_CHECKLIST.md`。

## 1. 三条命令的职责边界

### `bun run docker:smoke`

- 目标：验证 Docker 构建产物和协议级链路是否可用。
- 默认行为：
  - `docker compose up -d --build --wait`
  - 检查 `redis/backend/frontend` 健康态
  - 检查首页、安全头、静态缓存、`/api/health`、`/api/capabilities`
  - 检查前端实验室入口、系统监控入口、`/ws/generation`
  - 检查注册 -> 工作区 -> 上传链路
- 默认结束时会执行环境清理；调试时建议加 `--keep-up`。

### `bun run docker:ui-smoke`

- 目标：验证真实 Docker 前端页面的浏览器交互链路。
- 运行方式：
  - 直接命中 `http://127.0.0.1:18081`
  - 不启动本地 dev `webServer`
  - 使用独立 Playwright 配置 `playwright.docker.config.ts`
- 当前覆盖：
  - 注册并创建组织
  - 创建工作区
  - ComparisonLab 可见
  - 系统监控关键区块可见
  - Channel panel 可打开

### `bun run docker:drill:persistence`

- 目标：验证卷、SQLite 与上传文件在重启后仍然可用。
- 默认链路：
  - `compose up`
  - 注册组织 / 创建工作区
  - 创建项目快照
  - 上传文件
  - `restart veomuse-backend veomuse-frontend`
  - 复检 `/api/health`
  - 复检登录、工作区项目、成员、项目快照
  - 通过容器内文件检查确认上传文件仍在卷中
- 默认会清理环境；手工演练建议加 `--keep-up`。

## 2. 推荐执行顺序

### 最小正式验收

```bash
bun run docker:smoke -- --wait-timeout 240 --keep-up
bun run docker:ui-smoke
bun run docker:drill:persistence -- --wait-timeout 240 --no-build --keep-up
bun run docker:reset
```

### 说明

- 第一条命令负责把最新镜像真正构建出来，并完成协议级 smoke。
- 第二条命令在已起好的 Docker 网关上做浏览器级 smoke。
- 第三条命令复用现有镜像与容器环境，专门做持久化与重启验证。
- 最后一条命令清理 compose 环境但保留卷。

## 3. `--keep-up` 与 `--no-build`

### `--keep-up`

- 用途：保留容器在线，便于接着跑 `docker:ui-smoke`、人工排查或继续 drill。
- 适用：
  - `docker:smoke`
  - `docker:drill:persistence`
- 不适用：
  - `docker:ui-smoke` 自己不负责起停容器。

### `--no-build`

- 用途：跳过镜像重建，只验证当前本机已有镜像。
- 推荐场景：
  - `docker:smoke` 已在同一次会话里完成 `--build`
  - 继续跑 `docker:drill:persistence`
  - 排查运行态而不是构建链路

## 4. 清理命令

### 标准清理

```bash
bun run docker:reset
```

- 行为：`docker compose down --remove-orphans`
- 保留卷数据，适合日常验收后收尾。

### 清卷重置

```bash
bun run docker:reset:volumes
```

- 行为：`docker compose down --volumes --remove-orphans`
- 会清理 `veomuse-data` 与 `veomuse-uploads`
- 只适用于需要完全回到干净基线的场景

## 5. 当前已验证结论

- `docker:smoke --build` 已真实通过
- `docker:ui-smoke` 已真实通过
- `docker:drill:persistence` 已真实通过
- Docker 构建层已优化：
  - backend 镜像只安装 `@veomuse/backend` 生产依赖
  - frontend builder 只安装 `@veomuse/frontend` workspace 依赖
  - Bun install cache mount 已启用

## 6. 已知限制

- `docker:drill:persistence` 会真实重启 `backend/frontend`
- 若脚本不带 `--keep-up`，会按各自默认清理策略回收环境
- 持久化 drill 当前通过容器内文件检查验证上传文件仍在卷中
- 目前网关没有直接暴露 `/uploads/*` 下载复检路径
- CI 里的 `docker-ui-smoke` 适合 main-only 后置验证，不建议塞进 PR 主门禁

## 7. 常见故障排查

### 7.1 Docker 构建看起来“卡在 bun install”

- 先确认是否真的卡死，还是在完整安装整仓依赖。
- 当前 Dockerfile 已优化成 workspace 过滤安装；若再次变慢，优先检查：
  - `config/docker/backend.Dockerfile`
  - `config/docker/frontend.Dockerfile`
  - 是否回退了 `--filter`
  - 是否删掉了 Bun cache mount

### 7.2 `docker:ui-smoke` 点击被页面遮挡

- 先确认用例是否先执行了：
  - `btn-reset-layout`
  - `btn-center-mode-fit`
- 当前 Docker UI smoke 已对“创建工作区”按钮使用更稳定的滚动与 DOM click 方式。
- 若后续视觉结构再变，优先同步更新 `tests/e2e/docker/auth-org-workspace-ui.spec.ts`。

### 7.3 healthcheck 一直不通过

- 查看容器状态：

```bash
docker compose -f config/docker/docker-compose.yml ps
docker compose -f config/docker/docker-compose.yml logs --tail 200
```

- 常见关注点：
  - `.env` 中 `REDIS_PASSWORD`、`JWT_SECRET`、`SECRET_ENCRYPTION_KEY`
  - backend `/api/health`
  - frontend nginx 反代是否正常

### 7.4 drill 失败但 smoke 成功

- 说明问题多半在“重启后状态恢复”，不是基础协议链路。
- 优先检查：
  - `VEOMUSE_DB_PATH`
  - `/app/data`
  - `/app/uploads`
  - 命名卷是否被误删
  - drill summary 中的 `workspaceId / projectId / snapshotId / uploadObjectKey`

## 8. 推荐人工复核输出

正式留痕时至少记录：

- 执行命令
- 是否带 `--keep-up` / `--no-build`
- `docker compose ps` 结果
- `docker:ui-smoke` 是否通过
- `docker:drill:persistence` summary
- 最终是否执行 `docker:reset` 或 `docker:reset:volumes`
