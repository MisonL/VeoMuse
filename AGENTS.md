# AGENTS.md - VeoMuse 仓库执行约束

本文件定义 AI 辅助开发在 VeoMuse 仓库中的长期执行规则。规则以可验证、可审计、可重复为目标。

## 1. 核心原则

- 沟通语言：全程使用中文。
- 事实优先：所有结论必须基于代码、测试、命令输出或版本控制记录。
- Debug-First：禁止为了先跑通而加入隐藏回退、静默容错、默认降级路径或 mock 成功路径。
- 阶段目标：先保证核心逻辑行为等价，再考虑性能优化和基准测试。
- 输出收束：回答直接覆盖当次诉求，不附加无关建议。

## 2. 工程工作流

所有功能、修复、重构、清理、部署流程调整，都按以下顺序执行：

```text
spec -> plan -> failing test -> implementation -> verification
```

- 设计规格写入 `docs/superpowers/specs/`。
- 实施计划写入 `docs/superpowers/plans/`。
- 先写失败测试并确认失败，再修改生产代码或长期文档。
- 每次只处理一个原子任务，不并行开发多个无关任务。
- 临时计划不取代代码事实；若文档与代码冲突，以当前代码、测试和 Git 记录为准。

## 3. 自审与回退

每个原子任务结束前必须完成：

- 对照验收标准逐条确认。
- 对照审查要求逐项检查。
- 运行最小相关测试，并记录命令结果。
- 运行 `git diff --check`。
- 用 `git diff --name-only` 确认无任务范围外残余改动。
- 未通过验证时不得声称完成。

## 4. 代码质量红线

- 禁止为迎合测试而硬编码假设。
- 不顺手修无关问题；发现问题可记录，但不混入当前任务。
- 遵循 SOLID、DRY、关注点分离、YAGNI。
- 命名清晰，抽象务实。
- 仅在关键或非直观逻辑处添加简洁注释。
- 显式处理边界条件，不隐藏失败。
- 核心业务逻辑优先依赖注入，不在流程中硬编码具体实现。
- 优先使用不可变数据结构，不通过隐式全局状态表达业务变化。

## 5. 复杂度约束

| 指标 | 上限 | 超限处理 |
| --- | --- | --- |
| 函数长度 | 50 行 | 拆分辅助函数 |
| 文件长度 | 300 行 | 按职责拆分 |
| 嵌套深度 | 3 层 | 使用卫语句或提前返回 |
| 位置参数 | 3 个 | 改为配置对象 |
| 圈复杂度 | 10 | 拆分分支逻辑 |
| magic number | 0 | 抽取命名常量 |

既有遗留文件超限时，不要求一次性重写；新改动不得继续扩大复杂度。

## 6. 纯文本与安全约束

- 代码、注释、日志字符串、Markdown 文档中禁止使用 Emoji 和装饰性 Unicode 符号。
- Markdown 使用 `-`、`*`、数字列表和 `**加粗**` 表达结构。
- 严禁在源码中硬编码密钥或凭证。
- 数据库访问必须使用参数化查询。
- 外部输入必须在边界处校验与净化。
- 用户在会话中临时粘贴密钥用于调试不等同于源码泄漏；只有写入源码文件才触发泄漏风险。

## 7. 测试与验证

推荐命令：

```bash
bun run lint
bun run build
bun run test
bun run test:dom
git diff --check
```

部署态验证：

```bash
bun run docker:up
bun run scripts/docker_smoke_check.ts --keep-up --no-build
bun run docker:ui-smoke -- --workers=1 --retries=0
```

前后端契约变更必须至少运行：

```bash
bun test tests/frontend_backend_api_alignment.test.ts
bun run quality:api-contract
```

UI 布局或视觉变更必须至少覆盖相关 DOM 或 Playwright 测试，并在浏览器中确认控制台无 error/warn。

## 8. 文档与清理

- 长期工程入口是 `README.md`、`docs/ENGINEERING_WORKFLOW.md`、`docs/TDD_WORKFLOW.md`、`docs/superpowers/README.md`。
- 阶段性 closure、acceptance、remaining 文档不再作为主导航入口。
- `docs/api-routes.generated.json` 属于受保护 generated 契约文件，不作为历史垃圾删除。
- 本地运行产物通过 `bun run scripts/clean_workspace.ts --runtime-only` 清理。
- 默认不提交临时文件、报告目录、编辑器缓存和个人配置。

## 9. Docker 服务

开发部署使用：

```bash
docker compose -f config/docker/docker-compose.yml up -d --build --wait --wait-timeout 180
```

固定入口：

- 前端网关：`http://127.0.0.1:18081`
- 健康检查：`http://127.0.0.1:18081/api/health`
- 后端容器端口：`33117`
- Redis 容器端口：`46379`

如果本地 `bun run build` 后要声明最新代码已部署，必须重新执行 `bun run docker:up`，不能只依赖已运行容器的 smoke 结果。

## 10. Skills 使用规则

- 任务开始前根据语义启用相关 skill。
- 用户显式提到 `$superpowers:using-superpowers`、TDD、调试、部署、前端设计等技能时，必须读取并遵循对应 `SKILL.md`。
- 启用技能时在沟通中说明技能名称和用途。
