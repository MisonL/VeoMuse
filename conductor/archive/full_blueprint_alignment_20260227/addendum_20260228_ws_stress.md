# 验收补档：P2 收口与协作压测（2026-02-28）

## 1. 目标
- 为 P2-03（协作平台化）补充可重复执行的 WebSocket 端到端压测脚本。
- 为数据库损坏修复能力补充运行配置可观测性（自动修复/巡检状态可视）。

## 2. 本次补充交付
- 新增协作压测脚本：`scripts/collab_ws_stress.ts`
  - 支持模式：
    - 直连后端压测（`API_BASE_URL`）
    - `SELF_HOST=1` 自启动后端压测
  - 压测动作：
    - 自动创建工作区
    - 多客户端连接 `/ws/collab/:workspaceId`
    - 并发发送 `timeline.patch` / `cursor.update` / `presence.heartbeat`
    - 汇总 `ackRate`、`avgAckMs`、`p95AckMs`、`errors`、`broadcasts`

- 新增数据库运行配置接口：`GET /api/admin/db/runtime`
  - 返回：`runtime + health + lastRepair`
  - 前端数据库自愈中心已接入展示与周期刷新。

- 新增数据库损坏演练脚本：`scripts/db_repair_drill.ts`
  - 命令入口：`bun run drill:db-repair`
  - 演练流程：
    - 复制当前数据库到 `data/drills/` 隔离目录
    - 注入头部损坏标记
    - 调用 `LocalDatabaseService.repairDatabaseFile(..., { force: true })`
    - 输出 JSON 报告（含 backup/quarantine/salvage 细节）

- 协作与数据库链路加固（收口补丁）：
  - 工作区 Owner 权限改为基于 `x-workspace-actor` + 成员真实角色校验，移除前端自报 `x-workspace-role` 信任路径。
  - WebSocket 协作连接增加“成员准入”校验，非成员连接直接拒绝。
  - 协作事件增加 `projectId` 归属校验，阻断跨 workspace 事件污染。
  - 运行时 DB 自动修复改为“仅损坏迹象触发”，避免非损坏异常误重建。
  - 补齐本地对象存储上传落盘接口：`PUT /api/storage/local-upload/:objectKey`。
  - 创意版本链改为递归查询，修复多代版本丢失问题。

## 3. 验证记录
- 构建验证：`bun run build` 通过
- 全量测试：`bun test tests/*.test.ts` 通过（本轮最新：`113 pass / 0 fail`）
- 新增回归覆盖：
  - `tests/collaboration_service.test.ts`
  - `tests/lip_sync_flow.test.ts`（新增 `sync_lip` -> `syncLip` 协议兼容断言）
  - `tests/world_link_consistency.test.ts`（新增跨请求 worldId 一致透传断言）
  - `tests/composition_service.test.ts`（新增 4K HDR / Spatial 编码参数断言）
  - `tests/timeline_virtualization.test.ts`（切换到真实虚拟化工具函数 + 边界裁剪）
  - `tests/action_optimistic_flow.test.ts`（导出按钮 pending 文案与 Hook 接入断言）
  - `tests/media_alchemy_translation_frontend_clone.test.ts`（翻译克隆片段字段正确性）
  - `tests/media_alchemy_style_vfx_preview_data.test.ts`（风格/VFX 预览数据回写字段正确性）
  - `tests/p2_end_to_end_flow.test.ts`（策略治理 -> 创意 Run -> 协作邀请 -> 上传链路端到端串联）
  - `tests/frontend_form_accessibility.test.ts`（补 App 导出质量下拉/资源搜索输入 `id+name` 与关键按钮可访问性断言）
  - `tests/model_marketplace_policy_api.test.ts`
  - `tests/creative_pipeline_versioning.test.ts`
  - `tests/workspace_platform_api.test.ts`
  - `tests/sqlite_db_auto_repair_guard.test.ts`
  - `tests/sqlite_db_runtime_api.test.ts`
  - `tests/db_repair_drill_script.test.ts`（演练命令入口与修复调用链校验）
- 前端真实用户路径验收补充：
  - Chrome DevTools MCP 复测已消除表单告警：`A form field element should have an id or name attribute`。
  - 修复项：`App` 导出质量选择器、`AssetPanel` 搜索输入补齐 `id/name`，并已纳入自动化回归。
  - 协作事件发送后新增本地即时回显（optimistic event），单人会话也可即时看到 `timeline.patch / cursor.update`，无需额外刷新。
- 协作压测实跑（`SELF_HOST=1 COLLAB_STRESS_CLIENTS=4 COLLAB_STRESS_ROUNDS=4 bun run stress:collab-ws`）：
  - `ackRate: 1.0`
  - `avgAckMs: 1.74`
  - `p95AckMs: 3.65`
  - `errors: 0`
  - `broadcasts: 72`
- 数据库损坏演练实跑（`bun run drill:db-repair`）：
  - `repairStatus: repaired`
  - `copiedRows: 43`
  - `actions: backup + quarantine + salvage + rebuild`
  - 报告文件：`data/drills/db-repair-drill-2026-02-28T07-45-51-590Z.json`

## 4. 使用指令
```bash
# 常规压测
bun run stress:collab-ws

# 自启动后端压测
SELF_HOST=1 bun run stress:collab-ws

# 高并发压测样例
COLLAB_STRESS_CLIENTS=24 COLLAB_STRESS_ROUNDS=20 bun run stress:collab-ws

# 数据库损坏演练
bun run drill:db-repair
```

## 5. 结论
- P2 三项规划已具备：后端能力、前端可操作入口、自动化回归、压测脚本与文档闭环。
- 数据库损坏修复能力已完成“可执行 + 可追踪 + 可观测 + 触发守卫”四层收口。
