# VeoMuse 仓库全面清理与 Superpowers/TDD 迁移实施记录

## 1. 范围

本记录归档以下已落地内容：

- 清理仓库历史运行产物与样例垃圾目录的统一入口已落到 `scripts/clean_workspace.ts`。
- 主文档入口已重构，不再把阶段性 closure/acceptance 文档作为当前状态导航中心。
- `superpowers` 与 TDD 流程已写入长期工程文档。
- `docs/api-routes.generated.json` 作为 generated 契约文件继续受保护，不作为历史垃圾清理。

## 2. 约束

- 不回滚当前工作区已有业务改动。
- 不删除仍被脚本、测试、文档明确依赖的文件。
- 所有清理动作必须通过仓库根目录安全校验。
- 运行期清理使用 `--runtime-only`，避免误删依赖目录。

## 3. 执行记录

### 步骤 1：补充守卫测试，锁定目标契约

已通过以下测试锁定契约：

- `tests/acceptance_docs_presence.test.ts` 锁定 README、DEPLOYMENT、RELEASE_CHECKLIST 的长期入口要求。
- `tests/workflow_docs_presence.test.ts` 锁定工程流程、TDD 和 superpowers 文档存在性。
- `tests/clean_workspace_script.test.ts` 锁定清理脚本运行期目标、安全校验和 `--runtime-only` 行为。
- `tests/docker_cleanup_commands.test.ts` 锁定 Docker reset 命令入口。

### 步骤 2：建立长期工程工作流文档

已建立长期工程入口：

- `docs/ENGINEERING_WORKFLOW.md`
- `docs/TDD_WORKFLOW.md`
- `docs/superpowers/README.md`

这些文档明确 `spec -> plan -> failing test -> implementation -> verification` 流程，并由 README、RELEASE_CHECKLIST 和相关守卫测试引用。

### 步骤 3：重写长期入口文档

已调整长期入口文档：

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/CORE_FEATURES.md`
- `docs/RELEASE_CHECKLIST.md`

主入口文档不再将 closure/acceptance 文档作为当前状态导航中心，当前工程流程描述切换为持续开发流程。

### 步骤 4：归档或删除阶段性历史文档

已通过 `tests/acceptance_docs_presence.test.ts` 确认 README、DEPLOYMENT、RELEASE_CHECKLIST 不再引用旧 closure/acceptance/release closure 文档作为主入口。

### 步骤 5：升级统一清理脚本

已升级 `scripts/clean_workspace.ts`：

- 默认清理依赖、dist 和运行期产物。
- `--runtime-only` 只清理 `coverage/`、`playwright-report/`、`test-results/`、`artifacts/`、`uploads/imports/` 以及其他 uploads 运行期子目录。
- 清理后保留 `uploads/` 目录骨架和 `uploads/.gitkeep`。
- 仍通过根目录 `package.json` 的 name/workspaces 做安全校验。
- `package.json` 的 `clean` 命令指向 `bun run scripts/clean_workspace.ts`。

### 步骤 6：验证与收口

收口验证以守卫测试和 `git diff --check` 为准，确保文档、脚本、测试之间无明显契约断裂。

## 4. 执行关系

- 守卫测试先锁定目标契约。
- 长期工程文档与主入口文档同步落地。
- 历史 closure/acceptance 入口下线依赖主入口完成。
- 清理脚本扩展依赖根目录安全校验和运行期目录边界。
- 验证最后执行。

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

后续继续调整清理或工程流程时，仍遵循 TDD：先制造失败，再逐步收敛到通过，不直接修改目标文件后再补测试。
