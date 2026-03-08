# VeoMuse 剩余任务清单（V3.2）

## 当前基线

- 本地工程基线：`bun run lint`、`bun run build`、`bun run test`、`bun run release:gate` 已形成稳定回归路径。
- CI 基线：`CI Quality Gate`、`Docker Smoke (main push only)`、`Docker UI Smoke (main push only)` 最新线上执行均已成功。
- 当前阶段：研发结项已完成，进入外部后置验收阶段。
- 已确认不纳入当前排期：`24h` 长稳压测。
- 外部依赖限制：未配置真实 Provider 凭据时，`release:gate:real` 不能视为完成。
- 研发结项总览：`docs/RD_CLOSURE_2026-03-07.md`

## 后置验收事项（按优先级）

1. 生产环境 Docker 正式部署留痕

- 目标：把已完成的本地 Docker Compose 正式复核迁移到目标正式部署环境执行并留痕。
- 覆盖范围：`GET /`、`/api/health`、`/api/capabilities`、`/ws` 握手、上传链路、安全响应头、静态资源缓存。
- 当前自动化现状：`bun run docker:smoke` 已覆盖上述检查项与 `redis/backend/frontend` 健康态；本地正式复核已完成并留痕于 `docs/DOCKER_ACCEPTANCE_2026-03-07.md`。
- 剩余内容：在目标正式部署环境重新执行同等验收并留痕。
- 验收标准：目标环境 `redis/backend/frontend` 全部 `healthy`，网关首页与 API 正常，上传与 WebSocket 可用。

2. 实网回归闭环（阻塞后置验收）

- 前置条件：当前 real 用例默认依赖 `E2E_REAL_CHANNELS=true` 与 `GEMINI_API_KEYS`；`release:real:precheck` 会内置该开关并默认检查这两项，如需扩展多 Provider 实网回归，可通过 `E2E_REAL_REQUIRED_ENV_KEYS` 追加对应渠道凭据预检。
- 执行命令：
  - `bun run release:real:precheck`
  - `bun run e2e:regression:real -- --workers=1`
  - `bun run release:gate:real`
- 验收标准：real 用例非全 skipped，`artifacts/quality-summary.json` 中 `realE2E.status=passed`。

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
- 本地 Docker Compose 正式复核已完成：服务健康态、首页/API/WebSocket/上传链路、安全头与静态缓存均已验证，并已形成留痕文档 `docs/DOCKER_ACCEPTANCE_2026-03-07.md`。
- 后端四个大服务第一轮职责拆分已完成：`LocalDatabaseService`、`WorkspaceService`、`ModelMarketplaceService`、`VideoGenerationService` 均已收口为 façade + 领域子模块。
- 当前研发结项总览已形成：`docs/RD_CLOSURE_2026-03-07.md`。

## 说明

- 若新增功能需求，请先更新 `docs/requirements/PROJECT_REQUIREMENTS.md`，再纳入排期。
- 当前仓库已满足“研发结项”口径。
- 若要声明“可正式上线”，仍需补齐目标正式部署环境的 Docker 留痕复核与真实渠道回归两项后置验收。
