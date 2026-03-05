# VeoMuse 剩余任务清单（V3.2）

## 当前状态

- 发布阻塞项：`0`（已全部修复并回归通过）
- 当前阶段：稳定性增强与实网验证
- 发布基线：`release:gate`、`quality:api-contract`、`test:coverage` 已通过

## 仍需推进（按优先级）

1. 实网回归闭环（高优先级）

- 目标：验证真实第三方渠道在生产配置下可用且稳定。
- 前置：配置 `GEMINI_API_KEYS` 等实网凭据。
- 执行：
  - `bun run release:real:precheck`
  - `bun run e2e:regression:real -- --workers=1`
  - `bun run release:gate:real`
- 验收：real 用例非全 skipped，`quality-summary.json` 中 `realE2E.status=passed`。

2. 24h 长稳压测（高优先级）

- 目标：建立全天候稳定性基线并固化阈值。
- 执行：`COLLAB_STRESS_PROFILE=long COLLAB_STRESS_DURATION_MINUTES=1440 bun run stress:collab-ws`
- 验收：`ackRate >= 0.99`，`errors=0`，无异常退出。

3. 创意工作台体验收口（中优先级）

- 目标：在 `1366/1440/1920` 分辨率下完成最终可用性收口。
- 范围：三栏密度、任务列表可读性、主操作一屏可达。
- 验收：关键控件无遮挡、无明显滚动抖动、主要流程可在单屏完成。

## 已完成能力摘要

- 工作区渠道权限边界修复（读 `viewer+`，写 `owner`）
- 评论/工作流运行复合游标稳定分页（`created_at + id`）
- 策略创建/更新防重复提交与渠道弹窗可访问性修复
- CI 门禁实例统一与默认全量回归修复
- 发布门禁 real E2E 预检与假绿防护

## 说明

- 旧审计过程文档已归档清理，当前文档只保留有效执行项。
- 若新增需求，请提交到 `docs/requirements/PROJECT_REQUIREMENTS.md` 后再入排期。
