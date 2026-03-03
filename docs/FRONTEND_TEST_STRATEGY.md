# 前端大型组件测试策略

## 目标

为大型容器组件建立可维护、可扩展、可稳定回归的测试分层，避免“全靠单文件覆盖率”导致的高耦合与高维护成本。

## 分层原则

1. 容器组件（Container）
   - 以组件级 DOM 集成测试为主，覆盖真实用户可见行为与关键交互路径。
   - 重点验证：按钮禁用/启用、关键列表渲染、关键流程入口事件触发、空态与非空态分支。

2. 纯逻辑模块（Logic）
   - 抽离格式化、归一化、判定逻辑到 `*.logic.ts`，以单元测试覆盖边界条件。
   - 重点验证：输入归一化、空值与异常兜底、布尔判定、分页与游标语义。

3. 页面级壳层（App）
   - 保留关键运行态交互与主流程守卫测试，不在壳层测试中深挖所有子面板细节。

## 已落地示例

1. `CollabModePanel`
   - 逻辑单测：`tests/collab_mode_panel_logic.test.ts`
   - 组件 DOM：`tests/collab_mode_panel_component.dom.test.tsx`

2. `App` 壳层
   - 运行态交互：`tests/app_component_interactions.dom.test.tsx`
   - SSR/分支守卫：`tests/app_component_runtime.dom.test.tsx`

## 新增大型组件时的最低测试要求

1. 新增一个 `*.logic.ts`（如果存在可抽离逻辑）。
2. 新增对应 logic 单测，覆盖正常路径 + 边界路径。
3. 新增至少一个组件级 DOM 测试，覆盖空态与非空态。
4. 不使用按文件路径硬忽略覆盖率作为长期方案。
