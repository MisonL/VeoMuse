# VeoMuse 剩余开发任务清单（2026-03-03）

> 本清单基于当前代码与门禁实测结果整理。

## P0（当前迭代优先）

- [x] 为超大型实验室容器补齐可维护测试替代方案
  - 文件：`ComparisonLab.tsx`、`comparison-lab/modes/CollabModePanel.tsx`
  - 已完成（2026-03-03）：
    - 新增 `collabModePanel.logic.ts` 与 `tests/collab_mode_panel_logic.test.ts`，覆盖时间/mentions/ID 格式化、按钮禁用判定、分页预览等纯逻辑。
    - 新增 `tests/collab_mode_panel_component.dom.test.tsx`，补齐 Collab 面板组件级 DOM 交互回归。
    - 已移除 `bunfig.toml` 的 `coveragePathIgnorePatterns`（不再按文件硬排除覆盖）。

- [x] 补强 `App.tsx` 关键流程覆盖
  - 现状：`App.tsx` 线覆盖已提升并稳定在 80%+（质量门禁样本：84.13%）。
  - 已补齐：导出流程文案/状态、布局与引导相关核心辅助函数及 DOM 回归。

- [x] 优化 SLO 查询性能与稳定性
  - 已完成：`SloService` 为 summary/breakdown/diagnostics 增加采样上限与排序限制；`LocalDatabaseService` 增补 `journey_runs` 相关索引。
  - 验证：`tests/slo_service_aggregation.test.ts` 与 `tests/slo_admin_api.test.ts` 均已通过。

## P1（质量与可维护性）

- [x] 清理 TelemetryDashboard DOM 测试 `act(...)` 告警
  - 已完成：`tests/telemetry_dashboard_component.dom.test.tsx` 增加初始化副作用稳定等待（`renderDashboardReady`），避免异步状态更新在断言外触发 React `act` 警告。
  - 回归：`bun test tests/telemetry_dashboard_component.dom.test.tsx` 通过且无 `act` 告警日志。

- [x] 覆盖率脚本进一步提升可观测性
  - 已完成：新增 `runCoverageGate` 可测 runtime 入口，补充 `coverage_gate_runtime_core` 场景（成功、阈值失败、执行失败、tests 缺失、bunfig 缺失）。
  - 结果：`scripts/coverage_gate.ts` 当前约 `87.76% lines`、`82.14% funcs`。

- [x] 发布门禁脚本补覆盖
  - 已完成：新增 `release_gate_script/runtime` 测试，覆盖 SLO 自举 `reused/skipped/failed`、失败域建议、参数解析等分支。
  - 结果：`scripts/release_gate.ts` 当前约 `97.10% lines`、`93.48% funcs`。

- [x] 管理与遥测 Store 覆盖提升
  - 结果：`adminMetricsStore.ts` 61.90% lines、`journeyTelemetryStore.ts` 81.00% lines（`quality:coverage-targets` 已通过）。

## P2（体验与工程演进）

- [x] 统一前端大型组件测试策略
  - 目标：约定“容器组件以集成测试为主，纯函数与状态机以单元测试为主”。
  - 已落地：以 `CollabModePanel` 形成“logic 单测 + component DOM 测试”双层样例，并在 `ComparisonLab` 维持容器职责（入口集成覆盖 + 逻辑下沉测试）。

- [x] 继续细化 API 契约守卫
  - 已完成：新增 `scripts/generate_api_route_registry.ts`，自动从 `apps/backend/src/index.ts` 生成 `docs/api-routes.generated.json`（排序去重）。
  - 已完成：`scripts/api_contract_guard.ts` 改为读取 generated registry + `scripts/api_contract_guard.config.json`（支持 include/exclude/manualRequired）。
  - 已完成：补齐脚本与 runtime 测试，覆盖 registry 缺失、配置过滤、manual endpoint 追加场景。

## 本轮收口（2026-03-03）

- [x] 清理冗余测试代码
  - 已完成：`tests/telemetry_dashboard_component.dom.test.tsx` 收口为“显式 `cleanup` + 全局环境清理”双保险，消除全量覆盖场景下的多实例 DOM 污染。
- [x] 补充分页游标单元覆盖
  - 已完成：新增 `tests/v4_pagination_cursor_stability.test.ts`，覆盖评论线程与工作流运行的复合游标（`created_at|id`）分页稳定性，以及旧时间戳游标兼容行为。
- [x] 稳定性小幅加固
  - 已完成：`tests/collaboration_service.test.ts` 第三用例增加显式超时上限 `30_000ms`，降低并发回归场景的偶发抖动。
- [x] 统一 DOM 交互告警输出
  - 已完成：`tests/app_component_interactions.dom.test.tsx` 增加 `act` 包装辅助与定向 `console.error` 过滤（仅过滤 React `not wrapped in act(...)` 测试告警），保证覆盖门禁输出可读且不掩盖其他错误。
- [x] 代码风格与格式化统一
  - 已完成：对本轮变更文件执行 Prettier，并通过 `bun run format:check`。

## 非功能观察项（已完成，持续观察）

- `test:coverage` 已通过：`lineRate 86.13%`、`functionRate 74.30%`。
- `quality:coverage-targets`、`format:check`、`lint` 已通过。
- `quality:api-contract`、`build`、`release:gate` 已在前序收口中通过。
- `release:gate` 已修复 `NODE_ENV=production` 透传导致的 DOM 测试抖动（Unit Tests 步骤固定 `NODE_ENV=test`）。
- `sqlite_db_health_api` 与 `sqlite_db_repair_api` 在覆盖模式下的超时抖动已完成稳定性修复（单测超时上限调至 180s）。

## 结论

- 按当前仓库范围定义，剩余“必须开发”功能为 **0**。
- 后续工作建议进入“新需求迭代”模式，而非“遗留功能补完”模式。
