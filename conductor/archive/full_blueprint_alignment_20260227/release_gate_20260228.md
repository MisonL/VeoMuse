# 发布级验收清单（2026-02-28）

## 1. 验收目标
- 对已完成规划进行发布前“长稳压测 + 故障回归”双重验收。
- 重点覆盖：协作实时通道稳定性、数据库损坏修复可执行性、关键故障链路恢复能力。

## 2. 长稳压测（协作 WS）
- 命令：
```bash
SELF_HOST=1 COLLAB_STRESS_CLIENTS=36 COLLAB_STRESS_ROUNDS=60 COLLAB_STRESS_ACK_TIMEOUT_MS=10000 bun run stress:collab-ws
```
- 结果摘要：
  - `clients`: `36`
  - `rounds`: `60`
  - `totalMessages`: `2916`
  - `ackCount`: `2916`
  - `ackRate`: `1.0`
  - `avgAckMs`: `83.28`
  - `p95AckMs`: `372.02`
  - `errors`: `0`
  - `broadcasts`: `100800`
  - `durationMs`: `8378.47`
- 结论：在高并发本地压测下，ACK 全成功、零错误，协作总线稳定。

## 3. 故障回归清单
- 命令：
```bash
bun test \
  tests/sqlite_db_auto_repair_guard.test.ts \
  tests/sqlite_db_health_api.test.ts \
  tests/sqlite_db_runtime_api.test.ts \
  tests/sqlite_db_repair_api.test.ts \
  tests/sqlite_db_repairs_api.test.ts \
  tests/sqlite_db_salvage.test.ts \
  tests/db_repair_drill_script.test.ts \
  tests/collaboration_service.test.ts \
  tests/workspace_platform_api.test.ts \
  tests/degrade_recovery_ui.test.ts \
  tests/resilience_demo.test.ts \
  tests/p2_end_to_end_flow.test.ts
```
- 原始汇总：
  - `20 pass`
  - `0 fail`
  - `148 expect() calls`
  - `Ran 20 tests across 12 files`
- 结论：数据库修复、协作权限、故障降级恢复、P2 主路径全部通过。

## 4. 数据库损坏修复演练
- 命令：
```bash
bun run drill:db-repair
```
- 结果摘要：
  - `repairStatus`: `repaired`
  - `repaired`: `true`
  - `copiedRows`: `43`
  - `actions`: `backup + quarantine + salvage + rebuild`
- 报告文件：
  - `data/drills/db-repair-drill-2026-02-28T07-45-51-590Z.json`
- 结论：数据库损坏注入后可自动完成隔离、回收与重建，演练闭环成立。

## 5. 发布门禁结论
- 功能完整性：通过
- 稳定性（高压协作）：通过
- 故障恢复（数据库 + 前端降级）：通过
- 可追溯性（脚本 + 测试 + 报告落盘）：通过

综合判定：`Release Gate = PASS`。
