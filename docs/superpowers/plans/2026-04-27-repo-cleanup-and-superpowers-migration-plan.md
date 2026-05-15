# VeoMuse 仓库全面清理与 Superpowers/TDD 迁移实施计划

## 1. 范围

本计划落实以下目标：

- 清理仓库历史运行产物与样例垃圾目录。
- 重构主文档入口，移除对阶段性 closure/acceptance 文档的主导航依赖。
- 将 `superpowers` 与 TDD 流程写入长期工程文档。
- 在不破坏现有脚本契约的前提下，保留必要 generated 文件并清退历史包袱。

## 2. 约束

- 不回滚当前工作区已有业务改动。
- 不删除仍被脚本、测试、文档明确依赖的文件。
- 所有实现先由失败测试锁定，再写生产代码或文档。
- 所有清理动作必须通过仓库根目录安全校验。

## 3. 实施步骤

### 步骤 1：补失败测试，锁定新目标契约

目标：

- 锁定 README、DEPLOYMENT、RELEASE_CHECKLIST 的新入口要求。
- 锁定清理脚本对运行产物和上传样例垃圾的覆盖要求。
- 锁定 superpowers/TDD 长期文档存在性和引用关系。

完成标准：

- 至少新增或修改一组测试，使当前仓库在改动前出现预期失败。

### 步骤 2：建立长期工程工作流文档

目标：

- 新增 `docs/ENGINEERING_WORKFLOW.md`
- 新增 `docs/TDD_WORKFLOW.md`
- 新增 `docs/superpowers/README.md`

完成标准：

- 文档内容明确 spec -> plan -> failing test -> implementation -> verification 流程。
- README 或其他长期入口明确引用上述文档。

### 步骤 3：重写长期入口文档

目标：

- 重写 `README.md`
- 重写 `docs/DEPLOYMENT.md`
- 按需调整 `docs/CORE_FEATURES.md`、`docs/RELEASE_CHECKLIST.md`

完成标准：

- 主入口文档不再将 closure/acceptance 文档作为当前状态导航中心。
- 当前工程流程描述切换为持续开发流程，而非一次性结项叙事。

### 步骤 4：归档或删除阶段性历史文档

目标：

- 下线旧 closure/acceptance/release closure 文档。
- 保留必要内容时迁移到归档目录，不再作为主入口。

完成标准：

- 仓库内无主文档继续引用这些历史文档。
- 若保留归档目录，归档位置和命名清晰。

### 步骤 5：升级统一清理脚本

目标：

- 扩展 `scripts/clean_workspace.ts`
- 按需调整 `package.json` 清理命令

完成标准：

- 能清理 `coverage/`、`playwright-report/`、`test-results/`、`artifacts/`、`uploads/imports/`
- 保留必要目录骨架和 `.gitkeep`
- 仍保留根目录安全校验

### 步骤 6：验证与收口

目标：

- 执行最小充分测试
- 检查悬空引用与脚本契约
- 确认无范围外误改

完成标准：

- 相关测试通过
- `git diff --check` 通过
- 文档、脚本、测试之间无明显契约断裂

## 4. 依赖顺序

- 步骤 1 是所有后续步骤前置条件。
- 步骤 2 和步骤 3 可在同一实现阶段推进，但先有文档再删旧入口。
- 步骤 4 依赖步骤 3 完成。
- 步骤 5 可与步骤 2/3 并行设计，但必须在失败测试存在后实现。
- 步骤 6 最后执行。

## 5. 风险控制

- 若发现某历史文档仍被测试或脚本隐式依赖，则先迁移依赖再删文件。
- 若 `uploads/` 下存在非样例的真实业务输入，则仅清 `uploads/imports/` 的历史样例媒体。
- 若文档入口改造触发大范围快照式失败，则优先修守卫测试和主入口，不扩散到无关业务逻辑。

## 6. 验证命令基线

优先执行与本次改动直接相关的命令：

- `bun test tests/acceptance_docs_presence.test.ts`
- `bun test tests/docker_cleanup_commands.test.ts`
- 新增的 superpowers/TDD 文档守卫测试
- 新增或调整的 clean workspace 行为测试
- `git diff --check`

视改动范围补充：

- `bun run lint`
- `bun run test`

## 7. 决策

按本计划进入实施时，遵循 TDD：先制造失败，再逐步收敛到通过，不直接修改目标文件后再补测试。
