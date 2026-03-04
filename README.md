<div align="center">

# VeoMuse

工业级 AI 视频创作平台（Bun Monorepo）。以“多模型生成 + 协作治理 + 可观测门禁”为核心，把视频生产从单点工具升级为可审计、可回滚、可持续优化的系统。

[![Runtime: Bun](https://img.shields.io/badge/runtime-bun-000000?style=flat-square)](https://bun.sh/)
[![Backend: Elysia](https://img.shields.io/badge/backend-elysia-111111?style=flat-square)](https://elysiajs.com/)
[![Frontend: React 19](https://img.shields.io/badge/frontend-react%2019-111111?style=flat-square)](https://react.dev/)
[![E2E: Playwright](https://img.shields.io/badge/e2e-playwright-111111?style=flat-square)](https://playwright.dev/)

[快速开始](#快速开始) · [Docker 部署](#docker-类生产部署) · [质量门禁](#质量门禁) · [文档导航](#文档导航)

</div>

---

## 项目定位

VeoMuse 面向团队级视频生产场景，提供：

- 多模型生成与策略路由（模型超市 + 治理策略 + 预算告警/降级）
- 协作工作区与评论评审（组织/工作区/成员权限/审计导出）
- 创意工作流与批处理（workflow + runs + batch jobs）
- 可靠性治理（SLO / 演练 / 告警 / ACK）
- 全链路质量门禁（契约、覆盖率、单测、E2E、发布门禁）

## 核心能力一览

| 能力域             | 前端入口                   | 后端能力                                                      |
| ------------------ | -------------------------- | ------------------------------------------------------------- |
| 模型总线与策略治理 | `ComparisonLab`            | `/api/models/**`, `/api/models/policies/**`                   |
| 创意工作流与批处理 | `ComparisonLab / Creative` | `/api/v4/creative/**`                                         |
| 协作评论与评审     | `ComparisonLab / Collab`   | `/api/projects/**`, `/api/v4/projects/:id/comment-threads/**` |
| 资产复用治理       | `ComparisonLab / Creative` | `/api/v4/assets/**`                                           |
| 可观测性与运维     | `TelemetryDashboard`       | `/api/admin/**`, `/api/v4/admin/reliability/**`               |
| 编辑器与导出       | `VideoEditor`              | `/api/video/compose`, `/api/storage/upload-token`             |

完整清单见 [docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)。

## 仓库结构

- `apps/backend`: Elysia 后端与业务服务
- `apps/frontend`: React 编辑器与运营控制台
- `packages/shared`: 共享类型与公共定义
- `tests`: 根级回归测试（API、脚本、对齐守卫）
- `docs`: API、部署、版本与需求文档

## 快速开始

本地开发默认端口：

- Backend: `http://127.0.0.1:33117`
- Frontend: `http://127.0.0.1:42873`

```bash
# 1) 安装依赖
bun install

# 2) 启动前后端
bun run dev

# 3) 构建校验
bun run build
```

## Docker 类生产部署

Docker 部署默认仅暴露前端网关端口：

- Gateway/Frontend: `http://127.0.0.1:18081`
- Health: `http://127.0.0.1:18081/api/health`

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose -f config/docker/docker-compose.yml ps
```

部署细节见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 质量门禁

```bash
# 类型与静态检查
bun run lint

# 统一格式化（Prettier）
bun run format

# 格式检查（CI 推荐）
bun run format:check

# 全量单测
bun run test

# 覆盖率门禁（产出 coverage/lcov.info 与 summary.json）
bun run test:coverage

# API 契约守卫（路由/文档/测试一致性）
bun run quality:api-contract

# E2E 冒烟
bun run e2e:smoke

# 发布门禁（security + build + test + e2e + slo）
bun run release:gate

# 一键全质量链路
bun run quality:full
```

## 文档导航

- 核心能力清单: [docs/CORE_FEATURES.md](docs/CORE_FEATURES.md)
- API 文档: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- 契约路由注册表: [docs/api-routes.generated.json](docs/api-routes.generated.json)
- 契约守卫配置: [scripts/api_contract_guard.config.json](scripts/api_contract_guard.config.json)
- 部署指南: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 前端测试策略: [docs/FRONTEND_TEST_STRATEGY.md](docs/FRONTEND_TEST_STRATEGY.md)
- 版本规范: [docs/VERSIONING.md](docs/VERSIONING.md)
- 需求总册: [docs/requirements/PROJECT_REQUIREMENTS.md](docs/requirements/PROJECT_REQUIREMENTS.md)

## 版本信息

- 当前版本：`V3.1.0`
- 变更记录：`CHANGELOG.md`
