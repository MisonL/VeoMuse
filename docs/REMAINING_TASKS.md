# VeoMuse 后续事项清单（V3.2）

## 当前基线

- 本地工程基线：`bun run lint`、`bun run build`、`bun run test`、`bun run release:gate` 已形成稳定回归路径。
- CI 基线：`CI Quality Gate`、`Docker Smoke (main push only)`、`Docker UI Smoke (main push only)` 最新线上执行均已成功。
- 当前阶段：研发结项与本地闭环结项均已完成。
- 已确认不纳入当前排期：`24h` 长稳压测。
- 外部依赖限制：未配置真实 Provider 凭据时，`release:gate:real` 保留为后续增强项。
- 研发结项总览：`docs/RD_CLOSURE_2026-03-07.md`
- 本地闭环留痕：`docs/LOCAL_CLOSURE_2026-03-09.md`
- 最新交付收口：`docs/DELIVERY_CLOSURE_2026-03-09.md`

## 当前结论

- 当前仓库已满足“本地闭环完成”口径。
- 当前没有阻塞本地交付的剩余开发任务。
- `2026-03-09` 已再次完成本地闭环复验、Docker/UI smoke、部署协议级只读验收与浏览器实审。
- 前端 Comparison Lab 的 controller / polling / workspace / auth 关键 hook 已补齐 contract / logic 护栏测试。
- 下述内容保留为后续增强项，而非当前阻塞项。

## 后续增强项

1. 目标部署环境 Docker 留痕验收

- 目标：把已完成的本地 Docker Compose 正式复核迁移到目标正式部署环境执行并留痕。
- 覆盖范围：`GET /`、`/api/health`、`/api/capabilities`、`/ws` 握手、安全响应头、静态资源缓存、可选管理员只读探针。
- 当前自动化现状：`bun run docker:smoke` 已覆盖上述检查项与 `redis/backend/frontend` 健康态；本地正式复核已完成并留痕于 `docs/DOCKER_ACCEPTANCE_2026-03-09.md`。
- 剩余内容：在目标正式部署环境主机本地执行 `bun run acceptance:deploy -- --base-url <target_url>` 并留痕。
- 验收标准：目标环境 `redis/backend/frontend` 全部 `healthy`，网关首页与 API 正常，WebSocket 可用，默认不写入生产数据。

2. 实网回归闭环

- 前置条件：real 用例依赖调用方显式设置 `E2E_REAL_CHANNELS=true` 与 `GEMINI_API_KEYS`；如需扩展多 Provider 实网回归，可通过 `E2E_REAL_REQUIRED_ENV_KEYS` 追加对应渠道凭据预检。
- 建议按两个层级执行：
  - 目标环境实网留痕：`E2E_REAL_CHANNELS=true bun run acceptance:real -- --base-url <target_url> --api-base-url <api_url>`
  - 仓库级完整真实渠道门禁：`bun run release:real:precheck`、`bun run e2e:regression:real -- --workers=1`、`bun run release:gate:real`
- 分工说明：
  - `acceptance:real` 用于目标部署环境的实网验收与留痕
  - `release:gate:real` 用于仓库级完整真实回归闭环
- 验收标准：
  - `acceptance:real`：外部 `@real` 用例非全 skipped，`artifacts/real-acceptance/<timestamp>/summary.json` 为 `passed`
  - `release:gate:real`：`artifacts/quality-summary.json` 中 `realE2E.status=passed`

## 非阻塞优化建议

1. 前端进一步精修

- 可选方向：视觉精修、监控入口进一步上提、剩余大文件继续压薄。
- 说明：不构成当前研发阻塞。

2. 后端进一步精修

- 可选方向：继续细化四个 façade 服务的内部边界。
- 说明：第一轮职责拆分已完成，不构成当前研发阻塞。

3. 类型债务与错误处理治理

- 可选方向：继续清理 `any / as any` 与历史异常吞掉场景。
- 说明：属于质量提升项，不构成当前研发阻塞。

4. 文档持续维护

- 目标：继续保持 `README`、`DEPLOYMENT`、`CORE_FEATURES`、`RELEASE_CHECKLIST` 与代码同步。
- 说明：当前结项口径已经统一。

## 本轮已完成摘要

- 后端入口继续拆分：`apps/backend/src/index.ts` 已压薄为 app 装配入口，启动调度迁入 `apps/backend/src/runtime/bootstrap.ts`。
- 后端路由按领域拆分：认证、组织、渠道、模型、AI、视频生成、工作区、项目治理、存储、V4 实验室等路由已独立成模块。
- 前端 `ComparisonLab` 持续拆分：认证/组织/渠道、工作区协作、V4 运维、视频生成、对比态管理、创意运行管理均已抽到 hooks。
- 前端 `TelemetryDashboard` 已开始拆纯展示块：概览、Provider 健康、治理预览、数据库摘要、SLO 数据列表已模块化。
- 发布门禁脚本模块化：`scripts/release_gate.ts` 作为 façade，核心实现下沉到 `scripts/release-gate/`。
- 本地 Docker Compose 正式复核已完成：服务健康态、首页/API/WebSocket、安全头与静态缓存均已验证，并已形成留痕文档 `docs/DOCKER_ACCEPTANCE_2026-03-09.md`。
- 后端四个大服务第一轮职责拆分已完成：`LocalDatabaseService`、`WorkspaceService`、`ModelMarketplaceService`、`VideoGenerationService` 均已收口为 façade + 领域子模块。
- 当前研发结项总览已形成：`docs/RD_CLOSURE_2026-03-07.md`。
- 当前本地闭环留痕已形成：`docs/LOCAL_CLOSURE_2026-03-09.md`。

## 说明

- 若新增功能需求，请先更新 `docs/requirements/PROJECT_REQUIREMENTS.md`，再纳入排期。
- 当前仓库已满足“研发结项”和“本地闭环结项”口径。
- 若后续需要外部生产环境背书，可再执行目标环境 Docker 留痕复核与真实渠道回归。
