# VeoMuse

VeoMuse 是一个基于 Bun Monorepo 的 AI 视频创作与协作平台，覆盖素材编辑、模型路由、协作治理、可观测性和 Docker 部署链路。

## 主入口

- 工程工作流：[docs/ENGINEERING_WORKFLOW.md](docs/ENGINEERING_WORKFLOW.md)
- TDD 工作流：[docs/TDD_WORKFLOW.md](docs/TDD_WORKFLOW.md)
- Superpowers 入口：[docs/superpowers/README.md](docs/superpowers/README.md)
- 部署说明：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 发布检查清单：[docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)
- 运营证据索引：[docs/OPERATIONAL_EVIDENCE.md](docs/OPERATIONAL_EVIDENCE.md)
- 核心能力清单：[docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)
- API 说明：[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- 前端测试策略：[docs/FRONTEND_TEST_STRATEGY.md](docs/FRONTEND_TEST_STRATEGY.md)
- 需求文档：[docs/requirements/PROJECT_REQUIREMENTS.md](docs/requirements/PROJECT_REQUIREMENTS.md)

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
│  ├─ backend/
│  └─ frontend/
├─ packages/
│  └─ shared/
├─ tests/
├─ scripts/
├─ config/
└─ docs/
```

## 快速开始

### 1. 环境要求

- Bun `>= 1.3.9`
- Node.js
- Docker

### 2. 安装依赖

```bash
bun install
```

### 3. 初始化环境变量

```bash
cp .env.example .env
```

### 4. 启动开发环境

```bash
bun run dev
```

- Frontend: `http://127.0.0.1:42873`
- Backend: `http://127.0.0.1:33117`

## 常用命令

| 目标           | 命令                           |
| -------------- | ------------------------------ |
| 本地开发       | `bun run dev`                  |
| 构建           | `bun run build`                |
| Lint           | `bun run lint`                 |
| 测试           | `bun run test`                 |
| 覆盖率门禁     | `bun run test:coverage`        |
| API 契约守卫   | `bun run quality:api-contract` |
| Docker 烟测    | `bun run docker:smoke`         |
| Docker UI 烟测 | `bun run docker:ui-smoke`      |
| 发布门禁       | `bun run release:gate`         |
| 工作区清理     | `bun run clean`                |

## 发布与部署

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose -f config/docker/docker-compose.yml ps
```

- 网关地址：`http://127.0.0.1:18081`
- 健康检查：`http://127.0.0.1:18081/api/health`

## 工程约定

- 任何任务都先写 `spec` 和 `plan`，再进入实现。
- 所有实现都遵守 TDD，先写失败测试，再补最小实现。
- 阶段性 closure、acceptance、remaining 记录不再作为仓库主入口。
- `docs/api-routes.generated.json` 这类 generated 契约文件仍属于受保护资产，不作为历史垃圾清理。

## License

本项目采用 [LICENSE](LICENSE) 中定义的许可协议。
