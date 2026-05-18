# V3.3 可运营交付闭环设计规格

## 背景

VeoMuse 当前已经完成 V3.2 需求基线、P0/P1/P2 工作包、26 条 archive 轨道和 Nebula Flow WebUI 十二轮改造。主线 `main` 已与 `origin/main` 对齐，最新远端 `CI · Security Secrets Scan` 与 `CI · Quality Gate` 均通过，Docker Delivery 也已覆盖部署态 UI smoke。

当前风险不再是单点功能缺口，而是长期运营证据的稳定性：GitHub Actions 已出现 Node.js 20 actions deprecation 注解；北极星指标虽然写入需求文档，但缺少统一的周期化证据入口；Docker Delivery、部署验收、视觉回归和 DB 演练仍分散在不同脚本与 artifact 中。

## 总目标

V3.3 的总目标是把 VeoMuse 从“功能完成且门禁通过”推进到“可运营、可升级、可复验”的交付体系。

定义为：

- 主分支门禁在 GitHub Actions Node 24 默认环境前后保持稳定。
- 北极星指标具备可运行、可归档、可审计的证据入口。
- Docker 部署态、视觉核心 surface、数据库修复演练和安全门禁能被统一索引。
- 新增治理只做证据链与门禁增强，不新增 AI 业务能力，不重写已完成的 Nebula Flow 视觉结构。

## 设计原则

- **证据优先**：每个改动必须产生可复现命令、artifact 或 CI 结论。
- **小步原子化**：每轮只处理一个运营风险或证据缺口。
- **不重复造门禁**：复用现有 `release:gate`、`docker:smoke`、`docker:ui-smoke`、`acceptance:deploy`、`drill:db-repair` 和 manual workflows。
- **不静默降级**：门禁无法采集证据时必须显式失败或输出失败原因。
- **部署态优先**：涉及 UI、Docker、Nginx header、健康检查和懒加载 CSS 的结论以 Docker 或 CI 运行态为准。

## 范围

### 1. CI Node 24 兼容与注解清理

首个原子任务处理 GitHub Actions Node.js 20 deprecation 注解。

要求：

- 确认当前 workflow 使用的 actions 是否支持 Node 24。
- 为主线 Quality Gate 与 manual workflows 增加可验证的 Node 24 兼容策略。
- 通过守卫测试锁定 workflow 中的策略，避免后续回退。
- 保持现有 Release Gate、Docker Delivery、manual drill 行为不变。

### 2. 运营证据索引

建立一个轻量证据索引，汇总当前交付体系中已经存在的关键 artifact 与命令。

要求：

- 覆盖质量门禁、Docker Delivery、部署验收、真实 E2E、DB 修复演练和安全扫描。
- 明确每类证据的触发方式、产物路径、通过标准和跳过条件。
- 不替代现有 release checklist，只补齐运营视角的总览。

### 3. 北极星指标运行化

把 V3.2 需求文档中的北极星指标映射到现有脚本、CI 或待补守卫。

要求：

- 主链路成功率映射到浏览器 E2E 与 release gate。
- 非 AI API P95 映射到 SLO gate 与 `artifacts/slo-report.json`。
- DB 修复演练映射到 `drill:db-repair` 与 manual workflow。
- 主分支安全门禁映射到 secrets scan、鉴权回归、多租户越权回归相关测试。
- 对暂时无法自动化的指标明确标记为手动复验，不允许写成已自动覆盖。

### 4. 部署态视觉回归证据

Nebula Flow 第十二轮已经完成 `Experiment Bus` 部署态 overlay 守卫。V3.3 不继续盲目加视觉层，而是把核心 surface 的视觉证据纳入可复验范围。

要求：

- 覆盖编辑器首屏、实验室默认页、实验室监控页、音频大师页和关键弹窗。
- 重点检查 console error/warn、布局裁切、核心 bus 是否存在、懒加载 CSS 是否覆盖最终样式。
- 优先扩展 Docker UI smoke 或文档化已有 artifact，不新增主观截图结论。

## 非目标

- 不新增新的 AI 模型、生成能力、剪辑业务能力或后端业务 API。
- 不重写 `ComparisonLab`、Nebula Flow CSS layer 或已通过的 UI 结构。
- 不把所有 manual workflow 强制并入每次 push，避免 CI 变慢或不稳定。
- 不引入新的重型观测平台、数据库或外部 SaaS。
- 不为了消除注解而隐藏 GitHub Actions 真实警告。

## 阶段划分

### Phase 1: CI Node 24 兼容

目标是先处理最近会变成真实风险的 Actions 运行时注解。

验收：

- workflow 具备明确 Node 24 兼容策略。
- 有测试或脚本守卫该策略。
- 本地定向测试、`git diff --check`、远端 Secrets Scan 和 Quality Gate 通过。

### Phase 2: 运营证据索引

目标是建立 V3.3 的长期运营入口。

验收：

- 新增或更新文档能从一个入口找到 Quality Gate、Docker Delivery、deployment acceptance、real acceptance、DB drill 和 security scan 证据。
- 文档守卫测试覆盖关键命令与 artifact 路径。

### Phase 3: 北极星指标映射

目标是把需求文档中的 NS 指标变成可执行矩阵。

验收：

- 每个 NS 指标都有自动化、手动复验或暂不可覆盖的明确状态。
- 不存在“指标已覆盖”但没有命令或 artifact 的断言。

### Phase 4: 部署态视觉回归证据

目标是强化 UI 部署态回归，而不是继续堆叠视觉特效。

验收：

- Docker UI smoke 或其文档化 artifact 覆盖核心 surface。
- 关键 surface 的布局裁切和核心 Nebula Flow bus 语义可被自动验证。

## 首个原子任务

首个原子任务为 **CI Node 24 兼容与注解清理**。

建议边界：

- 只修改 `.github/workflows/`、相关 workflow 守卫测试和必要文档。
- 先写失败测试，锁定 workflow 中必须具备 Node 24 兼容策略。
- 再做最小 workflow 修改。
- 验证不低于：
  - `bun test <新增或修改的 workflow 守卫测试> --max-concurrency 1`
  - `git diff --check`
  - 推送后的 `CI · Security Secrets Scan`
  - 推送后的 `CI · Quality Gate`

## 风险与控制

- **风险：Node 24 变量或 action 支持策略理解错误。**
  - 控制：只使用 GitHub Actions 官方注解中给出的兼容开关或 action 官方支持路径，并让远端 CI 验证。
- **风险：manual workflows 被误改导致运维入口失效。**
  - 控制：新增守卫测试时覆盖所有 workflow 文件，不只覆盖主 Quality Gate。
- **风险：运营证据文档变成静态清单后漂移。**
  - 控制：后续 Phase 2 必须补文档守卫测试，锁定命令和 artifact 路径。
- **风险：视觉回归任务变成主观 UI 打磨。**
  - 控制：Phase 4 只接受自动化断言或部署态 artifact，不把“看起来更好”作为验收标准。

## 完成定义

V3.3 完成时应满足：

- 主线 CI 无 Node.js 20 deprecation 注解或已明确迁移到 Node 24 兼容策略。
- 运营证据入口能追溯发布、部署、验收、真实 E2E、DB drill 和安全扫描。
- 北极星指标都有可审计覆盖状态。
- Docker UI smoke 对核心部署态 surface 有稳定回归证据。
- 所有阶段都遵守 `spec -> plan -> failing test -> implementation -> verification`。
