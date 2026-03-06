# VeoMuse

VeoMuse 是一个基于 Bun Monorepo 的 AI 视频创作与协作平台，面向团队化视频生产场景，覆盖素材编辑、模型路由、创意工作流、协作评审、可观测性与发布门禁。

## 项目范围

- 创意生产：文本/图片转视频、导演分析、提示词增强、镜头建议、智能剪辑。
- 协作治理：组织、工作区、成员权限、评论/评审、模板应用、批量治理动作。
- 模型路由：多模型总线、渠道配置、策略治理、预算告警与降级。
- 可靠性：SLO、Provider 健康检查、数据库自愈、回归门禁、质量汇总。
- 编辑体验：时间轴、播放器同步、多面板工作台、任务闭环追踪。

详细能力见 [docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)。

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
│  ├─ backend/          # 后端 API、服务实现、runtime 启动逻辑
│  └─ frontend/         # 编辑器、实验室与前端面板
├─ packages/
│  └─ shared/           # 共享类型与公共定义
├─ tests/               # API / DOM / 对齐守卫 / E2E 回归
├─ scripts/             # 质量门禁、部署与运维脚本
├─ config/              # Docker、Nginx 与部署配置
└─ docs/                # 部署、API、测试、需求与路线文档
```

## 快速开始

### 1. 环境要求

- Bun `>= 1.3.9`
- Node.js（仅用于少量生态工具）
- Docker（用于容器部署与烟测，可选）

### 2. 安装依赖

```bash
bun install
```

### 3. 初始化环境变量

```bash
cp .env.example .env
```

生产环境至少需要补齐：`JWT_SECRET`、`SECRET_ENCRYPTION_KEY`、`REDIS_PASSWORD`、`ADMIN_TOKEN`。
如需真实 Provider 回归，还需要配置 `GEMINI_API_KEYS` 等外部凭据。

### 4. 启动本地开发

```bash
bun run dev
```

- Frontend: `http://127.0.0.1:42873`
- Backend: `http://127.0.0.1:33117`

## Docker 部署

推荐优先使用一键脚本：

```bash
bash scripts/one-click-deploy.sh
```

备用手动方式：

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose -f config/docker/docker-compose.yml ps
```

- 网关地址：`http://127.0.0.1:18081`
- 网关/API 联通检查：`http://127.0.0.1:18081/api/health`
- 详细部署说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 常用命令

### 开发与质量

| 目标            | 命令                           |
| --------------- | ------------------------------ |
| 本地开发        | `bun run dev`                  |
| 构建            | `bun run build`                |
| 类型检查与 Lint | `bun run lint`                 |
| 格式化          | `bun run format:prettier`      |
| 格式检查        | `bun run format:check`         |
| 单元与集成测试  | `bun run test`                 |
| 覆盖率门禁      | `bun run test:coverage`        |
| API 契约守卫    | `bun run quality:api-contract` |
| Docker 烟测     | `bun run docker:smoke`         |
| 全链路质量入口  | `bun run quality:full`         |

### 发布与回归

| 目标         | 命令                            |
| ------------ | ------------------------------- |
| E2E 冒烟     | `bun run e2e:smoke`             |
| 标准回归     | `bun run e2e:regression`        |
| 标准发布门禁 | `bun run release:gate`          |
| 真实凭据预检 | `bun run release:real:precheck` |
| 真实渠道门禁 | `bun run release:gate:real`     |

## 推荐发布流程

```bash
bun run format:check
bun run lint
bun run test
bun run quality:api-contract
bun run release:gate

# 仅在真实 Provider 凭据齐全时执行
bun run release:real:precheck
bun run release:gate:real
```

说明：

- `release:gate` 是标准本地发布门禁，覆盖 security/build/unit/e2e/slo。
- `release:gate:real` 额外验证真实第三方渠道，不会替代标准门禁。
- 质量汇总输出：`artifacts/quality-summary.json`
- SLO 报告输出：`artifacts/slo-report.json`

## 当前状态

- 后端入口与前端实验室已持续模块化，核心 API、DOM 与回归测试链路已稳定。
- Docker Compose、Nginx、质量门禁、数据库自愈与 SLO 面板均已接线完成。
- 当前仍需补齐的事项见 [docs/REMAINING_TASKS.md](docs/REMAINING_TASKS.md)。

## 已知限制

- 真实 Provider 成功率取决于外部凭据、额度和上游稳定性；未配置凭据时 `release:gate:real` 无法完成。
- 当前质量基线以本地/Mock 回归与 Docker 烟测为主，尚未把长时间连续压测纳入当前验收清单。

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
