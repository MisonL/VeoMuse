# VeoMuse V3.1 Pro 核心工程规范 (Instructional Context)

> [!IMPORTANT]
> **环境标注说明**：
> 所有的 `/conductor` 及其子命令（如 `:setup`, `:implement`, `:review` 等）以及 `/init` 指令，均为 **Gemini CLI** 环境专供的增强型指令。在标准 Shell 环境下，这些指令是不可用的。请始终在 Gemini 终端交互界面中使用它们以获取完整的规格驱动开发（Spec-Driven Development）体验。

---

## 🏗️ 架构总览 (Project Architecture)

本项目采用 **Bun Workspaces (Monorepo)** 结构，旨在实现全栈 100% 的强类型同步。

- **`apps/backend` (ElysiaJS)**: 工业级后端内核。
  - **核心准则**: 任何 AI 业务 Service 必须继承 `BaseAiService`，以自动获得指数退避重试与耗时量化能力。
- **`apps/frontend` (React 19)**: 旗舰级多轨道编辑器。
  - **核心准则**: 交互逻辑优先采用 **React 19 Actions** (`useActionState`)；播放同步强制通过 **Native SyncController** 直接驱动，严禁通过 React State 驱动高频播放更新。
- **`packages/shared`**: 逻辑桥接层。
  - **核心准则**: 所有 E2E 通讯接口（Clip, Track, Scene）均在此统一定义，严禁前后端代码直接跨应用引用。

---

## 🛠️ 构建与运维 (Commands)

### 1. 本地开发 (Local Development)
```bash
# 自动启动后端(3001)与前端(5173)
bun run dev
```

### 2. 生产构建 (Production Build)
```bash
# 执行 Vite 8 + Oxc 极速混淆构建
bun run build
```

### 3. Docker 部署 (Containerization)
```bash
# 一键拉起全栈镜像 (Debian-based Bun)
bun run docker:up
```

---

## ⚖️ 开发红线 (Engineering Standards)

1. **类型安全**: 通讯层必须通过 `treaty<App>(...)` 桥接，禁止任何 `any` 类型的透传。
2. **错误处理**: 严禁在 UI 裸写 `try...catch`，必须调用共享的 `getErrorMessage` 辅助函数。
3. **资源管理**: 后端必须保留 `setInterval` 自动巡检任务，确保 `uploads/generated` 目录 24 小时自愈。
4. **视觉一致性**: 严格遵循 **Premium Light** 亮色主题与物理弹性动效规范。

---
**VeoMuse - 以工匠之心，铸 AI 之魂。**
