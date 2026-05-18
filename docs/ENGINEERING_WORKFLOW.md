# VeoMuse 工程工作流

本文定义 VeoMuse 仓库的长期工程入口。仓库不再以阶段性结项文档驱动开发，而以持续交付流程驱动。

## 强制顺序

所有功能、重构、清理、修复任务都按以下顺序执行：

1. `spec`
2. `plan`
3. `failing test`
4. `implementation`
5. `verification`

禁止跳过前置阶段直接修改实现。

## 文档落点

- 设计规格：`docs/superpowers/specs/`
- 实施计划与实施记录：`docs/superpowers/plans/`
- 仓库级工作流说明：`docs/superpowers/README.md`
- TDD 细则：`docs/TDD_WORKFLOW.md`

## 标准执行方式

### 1. spec

- 先确认问题边界、依赖关系、非目标和风险。
- 设计文档写入 `docs/superpowers/specs/<date>-<topic>-design.md`。

### 2. plan

- 将设计拆成可验证步骤。
- 计划文档写入 `docs/superpowers/plans/<date>-<topic>-plan.md`。
- 完成后将同一文件回写为实施记录，避免长期入口保留过期计划态。

### 3. failing test

- 先让测试在当前状态下失败，锁定目标契约。
- 禁止先改实现再回填测试。

### 4. implementation

- 只实现被失败测试和计划覆盖到的最小必要变更。
- 不顺手修无关问题。

### 5. verification

- 运行最小充分测试。
- 检查 `git diff --check`。
- 确认无悬空引用、无静默降级、无范围外改动。

## 当前仓库约定

- 主入口文档由 `README.md`、`docs/DEPLOYMENT.md`、`docs/RELEASE_CHECKLIST.md` 组成。
- 阶段性 closure、acceptance、remaining 记录不再作为主导航入口。
- generated 契约文件如 `docs/api-routes.generated.json` 继续保留，并由脚本与测试守卫。
