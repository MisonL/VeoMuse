# Changelog

本项目遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/) 进行版本管理。  
发布日志格式参考 Keep a Changelog。

## [Unreleased]

### Added

- 新增 Docker 烟测脚本 `scripts/docker_smoke_check.ts`，支持 `up --wait`、健康探测、失败日志采集与自动清理。
- 新增 CI 作业 `docker-smoke-main`（仅 `main` 分支 push 触发）用于容器化基础可用性回归。
- 新增后端路由模块 `apps/backend/src/http/videoComposeRoute.ts`，承载 `/api/video/compose` 逻辑。

### Changed

- `apps/frontend` 的 `lint:eslint` 恢复为原生 `eslint . --ext .ts,.tsx`，不再依赖过滤脚本。
- 依赖覆盖策略新增 `browserslist@4.28.1`，与 `baseline-browser-mapping@2.10.0` 一并固定，降低依赖漂移风险。
- `ComparisonLab.tsx` 抽离通用解析与校验逻辑至 `comparison-lab/helpers.ts`，减少组件复杂度并提升可维护性。
- `docs/DEPLOYMENT.md` 补充 Docker smoke 使用方式与 CI 执行策略说明。

### Fixed

- 修复前后端类型检查中因路由拆分产生的残留未使用导入问题。
- 消除 `baseline-browser-mapping` 相关告警的依赖链根因（通过锁定上游 `browserslist` 版本）。
- 清理废弃脚本 `scripts/run_eslint_filtered.ts`，避免死代码继续留存。

## [3.2.0] - 2026-03-05

### Added

- 新增任务化视频生成闭环能力：`/api/video/generations` 及 `sync/retry/cancel` 生命周期接口。
- 新增 real E2E 预检脚本：`scripts/real_e2e_precheck.ts`，用于发布门禁前快速校验实网凭据。
- 新增 ComparisonLab 无障碍与请求防重相关测试覆盖（含键盘焦点循环与重复提交守卫）。

### Changed

- 发布门禁默认回归升级为全量 `e2e:regression`，不再仅限 mock 子集。
- CI 中 SLO seed 与 Playwright 后端地址统一，并支持复用已启动服务，降低“假绿”风险。
- 版本升级至 `v3.2.0`，同步更新核心文档标题与版本示例。
- 精简任务/审计文档，仅保留当前有效执行项与发布检查清单。

### Fixed

- 修复工作区渠道接口权限边界：读写分别按 `viewer+` 与 `owner` 鉴权。
- 修复评论与工作流运行分页在同时间戳下可能漏数据的问题（复合游标）。
- 修复渠道审计 trace 链路缺失与导出 `traceId` 为空问题。
- 修复策略创建/更新重复提交与渠道弹窗键盘可访问性问题。

## [3.1.0] - 2026-03-02

### Added

- 三平台一键安装部署脚本：
  - `scripts/one-click-deploy.sh`（macOS/Linux）
  - `scripts/one-click-deploy.ps1`（Windows PowerShell）
  - `scripts/one-click-deploy.cmd`（Windows CMD）
- `package.json` 新增一键部署命令：
  - `deploy:oneclick`
  - `deploy:oneclick:win`
- 增加 V3.2 下一阶段规划与需求基线文档：
  - `docs/requirements/PROJECT_REQUIREMENTS.md`
  - `docs/requirements/CONDUCTOR_ASSET_CONVERSION_MAP.md`

### Changed

- 发布文档与入口说明升级为“三平台一键部署”：
  - `README.md`
  - `docs/DEPLOYMENT.md`
- 协作/工作区鉴权文档统一为 Bearer + 成员角色模型。

### Fixed

- 协作 WebSocket 生命周期边界处理，减少无效会话导致的噪音与错误路径。
- 协作压测脚本鉴权链路对齐现网（register/login + Bearer + organization + userId 成员绑定）。

## [3.0.0] - 2026-02-28

### Changed

- 部署文档端口信息修正与重复内容清理，统一部署口径。

## [2.0.0] - 2025-11-19

### Changed

- 项目版本升级至 `v2.0.0`。

---

> 发布标签：`v2.0.0`、`v3.0.0`、`v3.1.0`、`v3.2.0`
