# 渠道接入模块 UX 审查优化实施记录

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化渠道接入中心的信息架构、作用域安全、OpenAI 兼容配置说明和视觉层级。

**Architecture:** 保持现有 `ChannelAccessPanel`、`useAuthOrganizationChannelManager` 和 `ChannelConfigService` 边界不变。前端先阻断明显错误的工作区作用域操作，后端保存/解析契约保持不变，视觉优化集中在 ComparisonLab 样式层。

**Tech Stack:** React, TypeScript, Bun test, Testing Library, CSS.

---

## Task 1: RED 测试

**Files:**
- Modify: `tests/channel_access_panel_accessibility.dom.test.tsx`
- Modify: `tests/use_auth_organization_channel_manager.logic.test.tsx`

- [x] 新增 DOM 测试，断言渠道面板展示“校验配置”、作用域摘要、OpenAI 协议提示和来源标签。
- [x] 新增 hook 测试，断言工作区作用域缺少 `workspaceId` 时保存被阻断，且不会调用组织级保存接口。
- [x] 运行 `bun test tests/channel_access_panel_accessibility.dom.test.tsx tests/use_auth_organization_channel_manager.logic.test.tsx --max-concurrency 1`，确认 RED 失败。

## Task 2: 实现交互与业务逻辑

**Files:**
- Modify: `apps/frontend/src/components/Editor/comparison-lab/ChannelAccessPanel.tsx`
- Modify: `apps/frontend/src/components/Editor/comparison-lab/hooks/useAuthOrganizationChannelManager.ts`

- [x] 增加作用域摘要与无工作区阻断提示。
- [x] 将渠道行操作“测试”改为“校验配置”。
- [x] 增加 OpenAI 兼容协议说明。
- [x] 切换 OpenAI 兼容协议时同步默认 endpoint，避免可见路径与实际协议冲突。
- [x] 在保存/校验前阻断无 `workspaceId` 的工作区作用域请求。
- [x] 在校验前阻断无组织上下文请求。

## Task 3: 视觉层级优化

**Files:**
- Modify: `apps/frontend/src/components/Editor/ComparisonLab.css`

- [x] 增加渠道面板顶部摘要、渠道状态条、字段网格、OpenAI 提示卡样式。
- [x] 保持移动端单列与无横向溢出。

## Task 4: 验证与记录

**Files:**
- Modify: `docs/superpowers/README.md`
- Modify: `docs/superpowers/plans/2026-05-19-channel-access-ux-review-plan.md`

- [x] 将新增 spec/plan 索引到 `docs/superpowers/README.md`。
- [x] 运行定向测试、DOM 测试、`bun run lint`、`bun run build`、`git diff --check`。
- [x] 将本计划回写为实施记录。

## 验证证据

- RED：`bun test tests/channel_access_panel_accessibility.dom.test.tsx tests/use_auth_organization_channel_manager.logic.test.tsx --max-concurrency 1` 首轮 4 pass，3 fail，失败命中缺少作用域摘要、工作区 option 未禁用、工作区阻断提示未触发。
- GREEN：`bun test tests/channel_access_panel_accessibility.dom.test.tsx tests/openai_compatible_driver_protocols.test.ts tests/use_auth_organization_channel_manager.logic.test.tsx --max-concurrency 1`：19 pass，0 fail。
- 渠道相关回归：`bun test tests/model_channels.test.ts tests/multi_tenant_channel_api.test.ts tests/use_auth_organization_channel_manager.logic.test.tsx tests/openai_compatible_driver_protocols.test.ts tests/channel_access_panel_accessibility.dom.test.tsx --max-concurrency 1`：24 pass，0 fail。
- API 契约：`bun test tests/frontend_backend_api_alignment.test.ts --max-concurrency 1`：1 pass，0 fail；`bun run quality:api-contract`：passed，routeCount 111，failures 0。
- DOM 回归：`bun run test:dom`：70 pass，0 fail。
- `bun run lint`：退出码 0。
- `bun run build`：退出码 0。
- `bun run test`：590 pass，0 fail。
- `git diff --check`：退出码 0。
- 浏览器 smoke：`bun run --cwd apps/frontend preview --host 127.0.0.1 --port 4173` 后打开 `http://127.0.0.1:4173/`，渠道面板可见，页面水平溢出为 0，控制台无消息。
- Claude 复核：确认协议切换同步绝对 URL endpoint 的修复无阻断问题。
- Gemini 复核：确认作用域 UX 与保存/校验阻断一致，未发现新的阻断问题。
