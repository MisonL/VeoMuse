# VeoMuse TDD 工作流

本文定义本仓库的 TDD 基线。

## 核心规则

- 先写失败测试。
- 再写最小实现。
- 通过后再做必要重构。
- 禁止先改实现再补测试。

## 执行节奏

1. 明确本轮要锁定的契约。
2. 写测试并确认当前失败。
3. 只做让测试通过所需的最小改动。
4. 跑定向测试。
5. 若有必要，再做不改变行为的整理。
6. 追加回归验证。

## 适用范围

以下任务也必须走 TDD，而不是只用于业务功能：

- 文档入口迁移
- 清理脚本重构
- 部署流程收敛
- 测试门禁调整
- API 契约或 generated 文件治理

## 推荐命令

定向守卫：

```bash
bun test tests/acceptance_docs_presence.test.ts
bun test tests/workflow_docs_presence.test.ts
bun test tests/clean_workspace_script.test.ts
```

仓库级验证：

```bash
bun run lint
bun run test
git diff --check
```

## 与 superpowers 的关系

TDD 不是孤立动作，而是 `using-superpowers -> brainstorming -> writing-plans -> test-driven-development -> verification-before-completion` 流水线中的实现阶段。
