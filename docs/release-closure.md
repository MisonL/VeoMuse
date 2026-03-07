# VeoMuse 发布与验收闭环收口说明（2026-03-07）

本文记录本轮“发布与验收闭环”收口范围，作为 `docs/RD_CLOSURE_2026-03-07.md`、`docs/DOCKER_ACCEPTANCE_2026-03-07.md` 的补充说明。
本文确认的是收口策略与验收口径，不替代正式环境上线审批。

## 收口范围

- 发布门禁失败说明补强：
  - `scripts/release_gate.ts` 在失败时输出增强摘要。
  - 输出内容聚焦失败步骤、失败域、重试次数、闭环状态、修复建议与 `artifacts/quality-summary.json` 工件路径。
- Docker smoke 轻量探针补强：
  - `scripts/docker_smoke_check.ts` 保留现有首页、API、WebSocket、上传、安全头、静态缓存探测。
  - 在此基础上新增“前端关键实验室入口”构建产物级探针。
  - 探针方式是抓取首页已引用的 JS 资源并校验实验室入口标识，不启动浏览器、不执行完整交互、不替代 E2E。
- 相关测试补齐：
  - 补 `release gate` 失败摘要输出测试。
  - 补 `docker smoke` 实验室入口标识解析测试。

## 当前验收口径

- `release:gate`
  - 仍以 `artifacts/quality-summary.json` 作为正式工件。
  - 本次未修改 schema，也未新增/删除字段。
  - 失败时控制台额外输出人类可读摘要，便于快速分流。
- `docker:smoke`
  - 仍定位为“轻量基线探测”，不是浏览器 E2E。
  - 新增实验室入口探针后，覆盖口径变为：
    - `GET /`
    - `/assets/*` 强缓存
    - 前端实验室入口 bundle 标识
    - `GET /api/health`
    - `GET /api/capabilities`
    - `/ws/generation` 握手
    - 注册 -> 工作区 -> 上传令牌 -> 上传链路

## 明确未做事项

- 未修改 `quality-summary.json` schema。
- 未把 `docker:smoke` 升级为浏览器 E2E。
- 未覆盖真实 Provider 凭据链路。
- 未替代正式部署环境上的最终留痕复核。

## 主线程后续注意事项

- 正式环境验收仍需单独执行并留痕：
  - 目标环境 Docker 复核
  - 真实凭据就绪后的 `bun run release:gate:real`
- `docker:smoke` 的实验室入口探针验证的是“构建产物包含关键入口标识”。
  - 它能发现入口 chunk 缺失、错误裁剪、关键文案/ID 丢失等问题。
  - 它不验证浏览器 hydration、点击交互、懒加载运行态副作用。
- 若后续实验室入口重命名：
  - 需要同步更新 `scripts/docker_smoke_check.ts` 中的入口标识集合及对应测试。
