# VeoMuse

> 基于 Bun Monorepo 的 AI 视频创作与协作平台

VeoMuse 面向团队化视频生产场景，覆盖素材编辑、模型路由、创意工作流、协作评审、质量门禁与发布流程。

## 项目定位

- 工程目标：构建可落地的 AI 视频生产系统，而不是单点 Demo
- 典型场景：文本/图片转视频、工作区协作评审、组织级治理与审计
- 运行方式：本地开发（Bun）+ 容器部署（Docker Compose）

## 核心能力

| 模块       | 能力                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 模型能力层 | 多模型总线、渠道配置、策略治理、预算与降级                                                          |
| 创意生产层 | 四种生成模式（`text_to_video` / `image_to_video` / `first_last_frame_transition` / `video_extend`） |
| 协作治理层 | 组织/工作区权限、评论与评审、审计导出                                                               |
| 可靠性层   | SLO、回归门禁、发布质量汇总、实网预检                                                               |
| 编辑体验层 | 时间轴编辑器、多面板工作台、任务闭环与状态追踪                                                      |

详细清单见 [docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)。

## 技术栈

| 领域     | 选型                   |
| -------- | ---------------------- |
| Runtime  | Bun `1.3.9`            |
| Frontend | React `19` + Vite      |
| Backend  | Elysia                 |
| Data     | SQLite + Redis         |
| Testing  | Bun Test + Playwright  |
| Deploy   | Docker Compose + Nginx |

## 仓库结构

```text
.
├─ apps/
│  ├─ backend/          # 后端 API 与服务实现
│  └─ frontend/         # 编辑器与实验室前端
├─ packages/
│  └─ shared/           # 共享类型与公共定义
├─ tests/               # API/脚本/对齐守卫回归测试
├─ scripts/             # 质量门禁、部署与运维脚本
├─ config/              # Docker/Nginx 等部署配置
└─ docs/                # 部署、API、测试与需求文档
```

## 快速开始

### 1. 环境要求

- Bun `>= 1.3.9`
- Node.js（仅用于少量生态工具）
- Docker（可选，用于容器化运行）

### 2. 安装依赖

```bash
bun install
```

### 3. 初始化环境变量

```bash
cp .env.example .env
```

生产环境请务必设置安全项：`JWT_SECRET`、`SECRET_ENCRYPTION_KEY`、`REDIS_PASSWORD`、`ADMIN_TOKEN`。

### 4. 启动本地开发

```bash
bun run dev
```

- Frontend: `http://127.0.0.1:42873`
- Backend: `http://127.0.0.1:33117`

## Docker 部署

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose -f config/docker/docker-compose.yml ps
```

- 网关地址：`http://127.0.0.1:18081`
- 健康检查：`http://127.0.0.1:18081/api/health`

部署细节见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 常用命令

### 开发与质量

| 目标           | 命令                           |
| -------------- | ------------------------------ |
| 本地开发       | `bun run dev`                  |
| 构建           | `bun run build`                |
| 类型检查/Lint  | `bun run lint`                 |
| 代码格式化     | `bun run format:prettier`      |
| 格式检查       | `bun run format:check`         |
| 单元与集成测试 | `bun run test`                 |
| 覆盖率门禁     | `bun run test:coverage`        |
| API 契约守卫   | `bun run quality:api-contract` |

### E2E 与发布

| 目标             | 命令                            |
| ---------------- | ------------------------------- |
| E2E 冒烟         | `bun run e2e:smoke`             |
| E2E 回归（全量） | `bun run e2e:regression`        |
| 发布门禁         | `bun run release:gate`          |
| 实网凭据预检     | `bun run release:real:precheck` |
| 实网门禁         | `bun run release:gate:real`     |
| 一键质量链路     | `bun run quality:full`          |

## 发布流程建议

```bash
bun run format:check
bun run lint
bun run test
bun run quality:api-contract
bun run release:gate

# 需要执行真实渠道回归时
bun run release:real:precheck
bun run release:gate:real
```

说明：

- `release:gate` 默认执行全量回归，不再仅限 mock。
- 质量汇总输出：`artifacts/quality-summary.json`
- SLO 报告输出：`artifacts/slo-report.json`

## 当前状态与已知限制

- 2026-03-05 审计中的 `P0/P1/S0` 阻塞项已修复并通过回归。
- real E2E 依赖外部凭据（如 `GEMINI_API_KEYS`），未配置时会被预检阻断。

## 文档导航

- 部署说明：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 发布检查清单：[docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)
- API 说明：[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- 核心能力清单：[docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)
- 前端测试策略：[docs/FRONTEND_TEST_STRATEGY.md](docs/FRONTEND_TEST_STRATEGY.md)
- 剩余任务与路线图：[docs/REMAINING_TASKS.md](docs/REMAINING_TASKS.md)
- 需求文档：[docs/requirements/PROJECT_REQUIREMENTS.md](docs/requirements/PROJECT_REQUIREMENTS.md)

## License

本项目采用 [LICENSE](LICENSE) 中定义的许可协议。
