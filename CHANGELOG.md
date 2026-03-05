# Changelog

本项目遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/) 进行版本管理。  
发布日志格式参考 Keep a Changelog。

## [Unreleased]

### Added

- 待补充

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
