# V3.2 北极星指标运营矩阵

本文把 `docs/requirements/PROJECT_REQUIREMENTS.md` 中的 V3.2 北极星目标映射到 V3.3 可运营交付闭环。覆盖状态只描述当前证据，不把手动复验写成自动通过。

| 指标                                        | 覆盖状态 | 运行入口                                                                 | 证据产物                                               | 通过口径                                                  |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------- |
| 关键主链路端到端成功率 >= 99.5%             | 自动覆盖 | `bun run e2e:smoke -- --workers=1 --retries=0` 与 `bun run release:gate` | `playwright-report/`、`artifacts/quality-summary.json` | E2E 与 Release Gate 均通过；真实渠道另看 real acceptance  |
| 非 AI API P95 响应时间 <= 400ms             | 自动覆盖 | `bun run release:gate`                                                   | `artifacts/slo-report.json`                            | main 分支使用 hard SLO gate，报告中非 AI API 样本满足阈值 |
| 新用户首次完成创建工作区到导出平均步骤 <= 8 | 手动复验 | 功能导览与主链路 E2E 复查                                                | 复验记录或后续专项 artifact                            | 当前缺少自动步数统计，不能声明自动通过                    |
| 数据库损坏修复演练脚本每周稳定通过          | 手动复验 | `bun run drill:db-repair` 或 `Manual · DB Repair Drill`                  | `data/drills/`、`artifacts/db-repair-drill.log`        | 每周 manual workflow 成功并上传演练日志                   |
| 主分支安全门禁全绿                          | 自动覆盖 | `CI · Security Secrets Scan` 与 `CI · Quality Gate`                      | `gitleaks.sarif`、`quality-gate-artifacts`             | Secrets Scan、Release Gate、Docker Delivery 均为 success  |
