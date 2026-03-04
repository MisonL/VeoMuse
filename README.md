# VeoMuse

VeoMuse 是一个基于 Bun Monorepo 的 AI 视频创作与协作平台。项目提供从素材编辑、模型路由、协作评审到可观测与发布门禁的完整工程链路，适用于团队化视频生产场景。

## 项目概览

- 当前版本：`3.1.0`
- 代码组织：`apps/* + packages/* + tests + docs`
- 运行形态：本地开发（Bun）与容器化部署（Docker Compose）

核心能力：

- 多模型总线与策略治理（模型超市、策略模拟、预算告警与降级）
- 创意工作流与批处理（workflow、runs、batch jobs、资产复用）
- 协作平台（组织/工作区/权限、评论与评审、审计导出）
- 可靠性治理（SLO、告警、ACK、回滚演练）
- 编辑器与导出（时间轴、多面板、视频合成）

详细清单见 [docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)。

## 技术栈

- Runtime: `Bun 1.3.9`
- Frontend: `React 19 + Vite`
- Backend: `Elysia`
- E2E: `Playwright`
- Data/Cache: `SQLite + Redis`
- Compose/Deploy: `Docker Compose + Nginx`

## 仓库结构

```text
.
├─ apps/
│  ├─ backend/          # 后端 API 与服务实现
│  └─ frontend/         # 编辑器与实验室前端
├─ packages/
│  └─ shared/           # 共享类型与公共定义
├─ tests/               # 根级 API/脚本/对齐守卫回归测试
├─ scripts/             # 质量门禁、部署与运维脚本
├─ config/              # Docker/Nginx 等部署配置
└─ docs/                # 部署、API、测试与需求文档
```

## 本地开发

### 1. 环境要求

- Bun `>= 1.3.9`
- Node.js（仅用于部分生态工具）
- Docker（可选，用于容器化运行）

### 2. 安装依赖

```bash
bun install
```

### 3. 准备配置

```bash
cp .env.example .env
```

说明：

- 开发场景可先使用最小配置启动。
- 生产场景必须配置安全项（如 `JWT_SECRET`、`SECRET_ENCRYPTION_KEY`、`REDIS_PASSWORD`、`ADMIN_TOKEN`）。
- 视频任务自动同步可通过环境变量调整（默认已开启）：
  - `VIDEO_JOB_AUTO_SYNC_ENABLED=true`
  - `VIDEO_JOB_AUTO_SYNC_INTERVAL_MS=20000`
  - `VIDEO_JOB_AUTO_SYNC_BATCH_SIZE=8`
  - `VIDEO_JOB_AUTO_SYNC_OLDER_THAN_MS=5000`

### 4. 启动服务

```bash
bun run dev
```

默认地址：

- Frontend: `http://127.0.0.1:42873`
- Backend: `http://127.0.0.1:33117`

## Docker 部署

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose -f config/docker/docker-compose.yml ps
```

默认网关地址：

- `http://127.0.0.1:18081`
- 健康检查：`http://127.0.0.1:18081/api/health`

部署细节见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 常用命令

| 目标          | 命令                           |
| ------------- | ------------------------------ |
| 启动本地开发  | `bun run dev`                  |
| 构建          | `bun run build`                |
| 代码检查      | `bun run lint`                 |
| 格式化        | `bun run format`               |
| 格式检查      | `bun run format:check`         |
| 单元/集成测试 | `bun run test`                 |
| 覆盖率门禁    | `bun run test:coverage`        |
| API 契约守卫  | `bun run quality:api-contract` |
| E2E 冒烟      | `bun run e2e:smoke`            |
| 发布门禁      | `bun run release:gate`         |
| 一键质量链路  | `bun run quality:full`         |

## 质量与发布基线

- 发布门禁入口：`bun run release:gate`
- 实网门禁入口：`bun run release:gate:real`
- `release:gate:real` 现在会校验 real 用例是否真正执行；若全部 `skipped` 会直接失败，避免“假绿灯”。
- 默认检查链路：`security -> build -> unit -> e2e(smoke/mock) -> slo`
- 质量汇总产物：`artifacts/quality-summary.json`
- SLO 报告产物：`artifacts/slo-report.json`

建议在发布前至少执行：

```bash
bun run format:check
bun run lint
bun run test
bun run quality:api-contract
bun run release:gate
```

## 文档索引

- 部署说明：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- API 说明：[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- 核心能力清单：[docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)
- 前端测试策略：[docs/FRONTEND_TEST_STRATEGY.md](docs/FRONTEND_TEST_STRATEGY.md)
- 剩余任务与路线图：[docs/REMAINING_TASKS.md](docs/REMAINING_TASKS.md)
- 需求文档：[docs/requirements/PROJECT_REQUIREMENTS.md](docs/requirements/PROJECT_REQUIREMENTS.md)

## 许可

本项目采用 [LICENSE](LICENSE) 中定义的许可协议。
