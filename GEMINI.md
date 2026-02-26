# VeoMuse V3.1 Pro 指导手册 (Instructional Context)

欢迎来到 **VeoMuse 旗舰版** 工程宇宙。本项目是 2026 年 AI 视频创作领域的工业级标准实现，采用极致的性能模型与前卫的架构设计。

---

## 🏗️ 架构总览 (Project Overview)

本项目采用 **Bun Workspaces (Monorepo)** 结构，实现全栈 100% 强类型自动同步。

- **`apps/backend` (ElysiaJS)**: 极速后端内核。
  - **核心模式**: 所有 AI 相关 Service **必须继承 `BaseAiService`**，以获得统一的重试（Exponential Backoff）、性能量化监控。
- **`apps/frontend` (React 19)**: 旗舰级编辑器。
  - **核心模式**: 全量应用 **React 19 Actions** (`useActionState`) 处理交互；使用 **Native SyncController** (Vanilla JS) 直接驱动多轨道音视频同步，绕过 React Diff 以获得 60fps 体验。
- **`packages/shared`**: 类型桥接层。
  - **作用**: 定义 E2E 通讯的所有共享接口（Clip, Track, Scene 等），解决循环依赖。

---

## 🛠️ 构建与运行 (Building and Running)

项目全量运行在 **Bun** 环境下。

### 开发环境 (Local Dev)
```bash
# 安装所有依赖 (根目录)
bun install

# 启动全栈开发模式
# 后端: http://localhost:3001
# 前端: http://localhost:5173
bun run dev
```

### 生产环境构建 (Build & Deploy)
```bash
# 前端构建 (Vite 8 + Oxc 混淆)
cd apps/frontend && bun run build

# Docker 一键部署 (全量构建)
docker-compose -f config/docker/docker-compose.yml up -d --build
```

---

## ⚖️ 开发规范 (Engineering Standards)

### 1. 类型安全 (Type Integrity)
- **Eden Treaty**: 前端必须使用 `treaty<App>(...)` 进行通讯。
- **Error Handling**: 禁止在 UI 层裸写 `try...catch`，必须使用 `getErrorMessage` 辅助函数。

### 2. 性能标准 (Performance)
- **LCP 目标**: < 1.2s。
- **帧率控制**: 120s 巨型时间轴操作时 FPS 不得低于 55。
- **静态资源**: Nginx 必须配置 CSP 与强缓存。

### 3. UI/UX 调性 (Aesthetics)
- **主题**: 默认提供 **Premium Light** (极简白 + 旗舰蓝) 与 暗色玻璃拟态。
- **动效**: 强制使用 **Spring Physics** (Framer Motion `type: 'spring'`)，杜绝简单的线性补间。

### 4. 资源自愈 (Maintenance)
- 后端必须具备 **24 小时自动物理清理** 机制，清理 `uploads/generated` 目录。

---

## 📜 常用命令 (Cheat Sheet)
- **重跑审计**: `bun test tests/*.test.ts`
- **物理路径检查**: `docker exec docker-veomuse-backend-1 ls /app/uploads`
- **全栈重构对齐**: 执行 `/conductor:review 复核所有代码`

---
**VeoMuse - 以工匠之心，铸 AI 之魂。**
