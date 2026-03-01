# Changelog

本项目遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/) 进行版本管理。  
发布日志格式参考 Keep a Changelog。

## [Unreleased]

### Added
- 预留下一版本变更记录区。

## [3.1.0] - 2026-03-02

### Added
- 三平台一键安装部署脚本：
  - `scripts/one-click-deploy.sh`（macOS/Linux）
  - `scripts/one-click-deploy.ps1`（Windows PowerShell）
  - `scripts/one-click-deploy.cmd`（Windows CMD）
- `package.json` 新增一键部署命令：
  - `deploy:oneclick`
  - `deploy:oneclick:win`
- 增加 V3.2 下一阶段规划文档与轨道登记：
  - `conductor/v3_2_next_phase_plan_20260302.md`
  - `conductor/tracks.md`（新增 V3.2 待执行轨道）

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
