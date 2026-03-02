# 仓库准则 (Repository Guidelines) - V3.1 旗舰版

> **以工匠之心，铸 AI 之魂。本项目已于 2026-02-27 完成全蓝图总装交付。**

## 🏗️ 架构与模块组织
本项目采用 **Bun Workspaces (Monorepo)** 旗舰级架构，确保全栈 100% 类型安全与 API 对齐。
- **`apps/backend` (ElysiaJS)**: 工业级 AI 路由总线。集成了 Telemetry 实时遥测、Multi-Driver 视频生成及 FFmpeg 异步合成引擎。
- **`apps/frontend` (React 19)**: 顶级多轨编辑器。采用 **Native SyncController** 驱动播放，强制使用 **useShallow** 拦截渲染熵值，主布局遵循 **Apple Pro Master Grid** 规范。
- **`packages/shared`**: 强类型契约层。统一定义 Clip, Track, Asset 等 E2E 接口。
- **`docs/requirements/`**: 项目正式需求基线与资产转换映射，包含总需求文档与全量来源追溯清单。

## 🛠️ 构建、部署与运维
| 命令 | 说明 |
| :--- | :--- |
| `bun run dev` | 物理拉起全栈开发环境 (Backend: 33117, Frontend: 42873) |
| `bun run build` | 执行 Vite 8 + Oxc 极速生产混淆构建 |
| `bun test` | 运行全量 35 项原子级回归测试套件 |
| `bun run docker:up` | **结项推荐**: 一键部署 Nginx 18081 + Bun 生产容器总线 |

## ⚖️ 工程红线 (Strict Guidelines)
- **视觉一致性**: 严格遵循 **Obsidian Pro** 视觉规范。使用 16px 圆角、12px 间距及内联变量 (`--ap-`) 驱动 UI。
- **物理 ID 锁定**: 核心交互按钮必须绑定 `id="tool-*"` 或 `id="btn-*"`，确保自动化审计 100% 连通。
- **效能规范**: 严禁在播放状态下触发 React 全量重绘；硬件遥测指标必须每 2 秒物理轮询一次后端 API。
- **错误闭环**: 所有 API 异常必须通过 `getErrorMessage` 辅助函数转化为用户可理解的专业 Toast。

## 🧪 交付验证
- **测试框架**: `bun:test`。
- **回归要求**: 任何二次开发必须保持 `tests/*.test.ts` 100% 绿灯。
- **Mock 策略**: 严禁在测试环境中发起真实 AI 请求，必须使用 `mock(fetch)` 模拟层。

---
**VeoMuse V3.1 Pro - 已圆满交付。**
