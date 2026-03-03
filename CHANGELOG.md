# Changelog

本项目遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/) 进行版本管理。  
发布日志格式参考 Keep a Changelog。

## [Unreleased]

### Added

- 新增发布门禁脚本与命令：
  - `scripts/release_gate.ts`
  - `bun run release:gate`
  - `bun run release:gate:real`
- 新增浏览器级主链路回归用例（注册 -> 组织 -> 工作区 -> 生成 -> 导出）：
  - `tests/e2e/regression/auth-org-workspace-generate-export.mock.spec.ts`
  - `tests/e2e/regression/auth-org-workspace-generate-export.real.spec.ts`
- `package.json` 新增 E2E 分层命令：
  - `e2e:regression:mock`
  - `e2e:regression:real`
- 新增 `tests/slo_gate_script.test.ts`，覆盖：
  - SLO API 不可达时 `soft/hard` 差异行为
  - 样本阈值不足门禁
  - 报告 schema 字段完整性

### Changed

- 数据库修复 API 支持 `checkMode`（`quick`/`full`）并引入默认策略：
  - `force=false` 默认 `quick`，降低非强制巡检耗时
  - `force=true` 默认 `full`，提升强制修复前判断精度
- 更新数据库修复相关文档与共享类型定义，增强前后端契约可读性。
- `scripts/slo_gate.ts` 升级为模式化门禁：
  - 新增 `--mode soft|hard`、`SLO_GATE_MODE`
  - 新增样本阈值 `SLO_GATE_MIN_NON_AI_SAMPLES`、`SLO_GATE_MIN_JOURNEY_SAMPLES`
  - 报告新增 `schemaVersion`、`sampleChecks`、`recommendations`
- `scripts/release_gate.ts` 改为按分支自动选择 SLO 模式：
  - 默认 `main=hard`，其他分支=`soft`
  - 支持 `RELEASE_SLO_MODE` 手动覆盖
- CI 质量门禁接入 Mock 回归与 SLO 门禁，并上传 `artifacts/slo-report.json`
- `scripts/provider_chain_e2e.ts` 旅程埋点 meta 新增 `flowVersion`、`scenarioId`、`buildRef`

### Fixed

- 修复 `tests/sqlite_db_repair_api.test.ts` 中“非强制修复检查”超时问题（原因为默认全量完整性检查耗时过高）。

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

> 发布标签：`v2.0.0`、`v3.0.0`、`v3.1.0`
