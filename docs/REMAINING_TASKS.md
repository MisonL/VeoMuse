# VeoMuse 剩余任务清单（V3.2）

## 当前基线

- 本地工程基线：`bun run lint`、`bun run build`、`bun run test`、`bun run release:gate` 已形成稳定回归路径。
- 当前阶段：结构化收口、Docker 正式部署验收、真实渠道补验。
- 已确认不纳入当前排期：`24h` 长稳压测。
- 外部依赖限制：未配置真实 Provider 凭据时，`release:gate:real` 不能视为完成。

## 剩余事项（按优先级）

1. Docker 正式部署复核

- 目标：把 Docker Compose 作为正式交付基线重新验收一遍。
- 覆盖范围：`GET /`、`/api/health`、`/api/capabilities`、`/ws` 握手、上传链路、安全响应头、静态资源缓存。
- 验收标准：`redis/backend/frontend` 全部 `healthy`，网关首页与 API 正常，上传与 WebSocket 可用。

2. 实网回归闭环（阻塞后置验收）

- 前置条件：当前 `release:real:precheck` 只硬性校验 `GEMINI_API_KEYS`；如需扩展多 Provider 实网回归，再按场景补充对应渠道凭据。
- 执行命令：
  - `bun run release:real:precheck`
  - `bun run e2e:regression:real -- --workers=1`
  - `bun run release:gate:real`
- 验收标准：real 用例非全 skipped，`artifacts/quality-summary.json` 中 `realE2E.status=passed`。

3. 前端大文件继续收口

- 目标文件：`apps/frontend/src/App.tsx`、`apps/frontend/src/components/Editor/comparison-lab/modes/CollabModePanel.tsx`、`apps/frontend/src/components/Editor/comparison-lab/modes/CreativeModePanel.tsx`、`apps/frontend/src/components/Editor/TelemetryDashboard.tsx`。
- 当前方向：继续把纯展示块、面板动作、状态编排拆到独立组件或 hooks。
- 验收标准：不改变交互语义，现有 DOM/SSR/对齐测试保持通过。

4. 后端大文件继续收口

- 目标文件：`apps/backend/src/services/LocalDatabaseService.ts`、`apps/backend/src/services/WorkspaceService.ts`、`apps/backend/src/services/ModelMarketplaceService.ts`、`apps/backend/src/services/VideoGenerationService.ts`。
- 当前方向：按领域拆出查询、命令、修复/同步任务和 DTO 归一化层。
- 验收标准：API 契约不变，现有路由测试与服务测试保持通过。

5. 类型债务与错误处理治理

- 目标：继续清理生产代码与脚本中的 `any / as any`，为历史空 `catch` 补最小粒度日志。
- 优先范围：`scripts/`、前端网络边界、后端服务适配层。
- 验收标准：生产代码中的类型豁免继续下降，异常不再静默吞掉。

6. 文档与部署说明持续对齐

- 目标：保证 `README`、`DEPLOYMENT`、`CORE_FEATURES`、`RELEASE_CHECKLIST` 与真实代码和 Compose 配置一致。
- 重点：Nginx 配置路径映射、网关职责、发布门禁口径、Docker 验收前置条件。

## 本轮已完成摘要

- 后端入口继续拆分：`apps/backend/src/index.ts` 已压薄为 app 装配入口，启动调度迁入 `apps/backend/src/runtime/bootstrap.ts`。
- 后端路由按领域拆分：认证、组织、渠道、模型、AI、视频生成、工作区、项目治理、存储、V4 实验室等路由已独立成模块。
- 前端 `ComparisonLab` 持续拆分：认证/组织/渠道、工作区协作、V4 运维、视频生成、对比态管理、创意运行管理均已抽到 hooks。
- 前端 `TelemetryDashboard` 已开始拆纯展示块：概览、Provider 健康、治理预览、数据库摘要、SLO 数据列表已模块化。
- 发布门禁脚本模块化：`scripts/release_gate.ts` 作为 façade，核心实现下沉到 `scripts/release-gate/`。

## 说明

- 若新增功能需求，请先更新 `docs/requirements/PROJECT_REQUIREMENTS.md`，再纳入排期。
- 若要声明“可正式上线”，仍需补齐 Docker 正式部署复核与真实渠道回归两项验收。
