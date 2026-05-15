# VeoMuse 仓库全面清理与 Superpowers/TDD 迁移设计

## 1. 背景与事实

基于 `2026-04-27` 对仓库现状的实际检查，当前 VeoMuse 存在以下结构性包袱：

- 仓库根目录累积了大量本地产物目录：`coverage/`、`playwright-report/`、`test-results/`、`artifacts/`、`uploads/imports/`。
- `bun run clean` 当前仅清理 `node_modules` 与前后端 `dist`，未覆盖上述主要运行产物。
- `README.md`、`docs/DEPLOYMENT.md`、`docs/CORE_FEATURES.md` 当前把 `RD_CLOSURE`、`LOCAL_CLOSURE`、`DOCKER_ACCEPTANCE`、`REMAINING_TASKS` 这些阶段性文档作为“当前状态入口”。
- `docs/api-routes.generated.json` 并非纯历史文件，仍被 `scripts/generate_api_route_registry.ts` 与 `scripts/api_contract_guard.ts` 使用，并被 `docs/API_DOCUMENTATION.md` 引用。
- 现有测试已经对文档入口、Docker 清理命令、CI 统一门禁有守卫，清理时必须同步更新测试契约。
- 当前工作区存在大量未提交业务改动，因此本次清理必须避免误伤正在进行中的功能修改。

## 2. 目标

- 清理仓库中的历史运行产物、冗余记录和阶段性收口文档，降低认知噪音。
- 将仓库工作流入口统一迁移到 `superpowers` 体系。
- 将“先写失败测试，再写实现，再做收口验证”确立为显式 TDD 流程，而不是口头约定。
- 保留仍被代码、脚本或测试依赖的必要文件，避免把活跃契约误删为“历史包袱”。

## 3. 非目标

- 不在本次清理中重构业务功能实现。
- 不回滚当前工作区已有的前后端功能改动。
- 不删除任何仍被脚本、测试、文档主入口直接依赖的生成契约文件。
- 不在未建立替代入口前直接删除根文档引用对象。

## 4. 设计原则

- 先迁移入口，再删除旧物，避免悬空引用。
- 先补失败测试，再做清理动作，遵守 TDD。
- 清理范围以“当前可证明无必要”为准，不做主观臆断删除。
- 把“阶段性结项记录”下沉为归档，把“长期入口文档”上提为主导航。
- 所有清理动作都要可自动化重放，避免一次性人工操作。

## 5. 激进重构方案

### 5.1 文档体系重构

保留长期文档：

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/API_DOCUMENTATION.md`
- `docs/CORE_FEATURES.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/FRONTEND_TEST_STRATEGY.md`
- `docs/requirements/PROJECT_REQUIREMENTS.md`

新增长期工作流文档：

- `docs/ENGINEERING_WORKFLOW.md`
- `docs/TDD_WORKFLOW.md`
- `docs/superpowers/README.md`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`

归档或下线的阶段性文档目标：

- `docs/DELIVERY_CLOSURE_2026-03-09.md`
- `docs/DOCKER_ACCEPTANCE_2026-03-07.md`
- `docs/DOCKER_ACCEPTANCE_2026-03-08.md`
- `docs/DOCKER_ACCEPTANCE_2026-03-09.md`
- `docs/LOCAL_CLOSURE_2026-03-08.md`
- `docs/LOCAL_CLOSURE_2026-03-09.md`
- `docs/RD_CLOSURE_2026-03-07.md`
- `docs/REMAINING_TASKS.md`
- `docs/release-closure.md`

处理策略：

- 不再把上述阶段性文档作为 README 和部署文档的“当前状态入口”。
- 将其中仍有长期价值的内容吸收到新的长期文档中。
- 被保留的旧文档若仍需留痕，则迁移到明确的归档区，例如 `docs/archive/`，不再占据主导航。

### 5.2 运行产物与样例垃圾清理

清理目标：

- `coverage/`
- `playwright-report/`
- `test-results/`
- `artifacts/` 下的本地产物
- `uploads/imports/` 下积累的样例导入媒体

保留策略：

- `uploads/.gitkeep` 保留。
- 运行中实际依赖的目录骨架保留，但目录中的历史内容清空。
- 任何被测试或脚本约定为输出目标的目录，需要通过脚本自动重建。

### 5.3 清理脚本体系重构

将 `scripts/clean_workspace.ts` 从“只删依赖和 dist”升级为统一清理入口，覆盖：

- 依赖缓存清理
- 构建产物清理
- 测试报告清理
- 覆盖率清理
- 本地验收工件清理
- 样例导入垃圾清理

根脚本层面引入更明确的清理粒度，例如：

- `bun run clean`
- `bun run clean:runtime`
- `bun run clean:artifacts`
- `bun run clean:uploads`

是否拆成多个脚本命令，将在计划阶段根据测试约束细化。

### 5.4 Superpowers 工作流落地

将仓库正式工作流改为：

1. `using-superpowers`
2. `brainstorming`
3. `writing-plans`
4. `test-driven-development`
5. `verification-before-completion`

落地方式：

- 在长期文档中明确“任何功能、重构、清理任务都先走 spec -> plan -> failing test -> implementation -> verification”。
- 将仓库文档主入口改为引用 `docs/superpowers/README.md` 与 `docs/TDD_WORKFLOW.md`。
- 清理旧的“结项式叙事”，改为“持续工程流程叙事”。

### 5.5 TDD 强化

本次清理本身也遵守 TDD，至少覆盖以下失败测试场景：

- README 不应再引用历史结项文档作为主入口。
- DEPLOYMENT 不应再依赖旧 acceptance/closure 文档作为当前状态说明。
- 清理脚本必须覆盖 `coverage`、`playwright-report`、`test-results`、`artifacts`、`uploads/imports`。
- superpowers/TDD 工作流文档必须存在，并被主入口文档引用。
- 保留的 generated 契约文件仍需被脚本和测试正确识别。

## 6. 保留项清单

以下内容本次明确保留，不视为历史包袱：

- `docs/api-routes.generated.json`
- `scripts/generate_api_route_registry.ts`
- `scripts/api_contract_guard.ts`
- `.github/workflows/` 下现有门禁工作流
- 当前前后端业务代码改动
- 当前 E2E/UI smoke 契约

## 7. 风险与控制

主要风险：

- 文档删减后导致 README、DEPLOYMENT、测试守卫同时失效。
- 清理脚本误删开发期必要目录或用户本地数据。
- 激进迁移后工作流口径改变，但没有同步到测试和 CI。

控制方式：

- 先补失败测试，再做清理实现。
- 运行最小充分验证，优先执行与文档入口、清理脚本、工作流守卫直接相关的测试。
- 清理脚本内加入仓库根目录安全校验，并显式限定可删除路径。

## 8. 验收标准

- 仓库主入口文档不再把历史 closure/acceptance 文档作为当前导航中心。
- 旧阶段性文档完成归档或下线，且无悬空引用。
- `bun run clean` 或新的统一清理命令可实际清除主要历史运行产物。
- `superpowers` 与 `TDD` 工作流文档正式入库，并被 README 或长期工程文档引用。
- 相关测试通过，且不存在因为清理导致的脚本契约断裂。

## 9. 实施顺序

1. 建立失败测试，锁定新文档入口和清理脚本行为。
2. 新增长期工程流程文档与 superpowers/TDD 入口文档。
3. 重写 README、DEPLOYMENT、RELEASE_CHECKLIST 等长期入口。
4. 归档或删除阶段性 closure/acceptance 文档。
5. 扩展清理脚本并验证真实清理行为。
6. 执行回归验证并确认无悬空引用。

## 10. 决策

本次采用“激进重构”路径，但以可证明安全的入口迁移和测试先行为前提执行，不做无证据的批量删除。
