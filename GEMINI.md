# 仓库准则 (Repository Guidelines)

## 🏗️ 项目架构与模块组织
本项目采用 **Bun Workspaces (Monorepo)** 旗舰级架构，确保全栈 100% 类型同步。
- **`apps/backend` (ElysiaJS)**: 工业级 AI 总线。所有 AI Service 必须继承 `BaseAiService` 以获取遥测与重试能力。
- **`apps/frontend` (React 19)**: 顶级多轨编辑器。采用 **Native SyncController** 驱动播放，严禁 React State 驱动高频更新。
- **`packages/shared`**: 类型桥接层。统一定义 Clip, Track, Scene 等通讯接口。
- **`conductor/`**: Conductor 框架核心。包含所有规格说明 (`spec.md`) 与执行计划 (`plan.md`)。
- **`tests/`**: 全链路自动化测试套件。

## 🛠️ 构建、测试与开发命令
| 命令 | 说明 |
| :--- | :--- |
| `bun run dev` | 物理拉起全栈开发环境 (Backend: 3001, Frontend: 5173) |
| `bun run build` | 执行 Vite 8 + Oxc 极速混淆构建 |
| `bun test` | 运行全量单元与集成测试 |
| `bun run docker:up` | 一键部署生产容器 (Nginx 80 + Bun Backend) |

## ⚖️ 编码风格与命名规范
- **类型安全**: 必须通过 `treaty<App>(...)` 桥接，禁止使用 `any`。
- **视觉一致性**: 严格遵循 **Apple Pro (Obsidian)** 视觉规范。使用内联主题变量 (`--ap-`) 驱动 UI。
- **UI 准则**: 强制 12px 间距与 16px 圆角布局。
- **交互逻辑**: 必须为关键按钮绑定 **物理 ID** 以确保自动化审计。

## 🧪 测试准则
- **框架**: 使用 `bun:test`。
- **规范**: 采用 TDD 流程。每个 Track 必须配套 `tests/*.test.ts`。
- **Mock**: 严禁在测试中发起真实外部网络请求，必须 Mock `fetch` 响应。

## 🚀 提交与 Conductor 准则
- **提交规范**: `feat(scope): description` 或 `chore(conductor): ...`。
- **自动化流**: 所有代码变更必须物理对齐 `spec.md`。完成 Track 后需执行同步与清理协议。

---
**VeoMuse V3.1 Pro - 以工匠之心，铸 AI 之魂。**
