# 技术栈定义：VeoMuse 旗舰版

## 1. 核心运行时与架构
- **运行时 (Runtime)**: **Bun** (极速 IO 与文件处理)
- **后端框架 (Backend)**: **Elysia.js** (高性能，完美支持 Bun)
- **类型同步 (Type Safety)**: **Eden Treaty** (实现前后端 100% 类型自动同步)
- **架构模式**: **Monorepo (Bun Workspaces)**
    - `apps/backend`: Elysia API
    - `apps/frontend`: Vite + React
    - `packages/shared`: 共享类型与工具函数

## 2. 前端技术 (Frontend)
- **框架**: **React 18+** (用于构建复杂的剪辑交互)
- **构建工具**: **Vite**
- **样式**: **原生 CSS / CSS Modules** (极致的玻璃拟态定制)
- **动画**: **Framer Motion** (Premium 级别的交互动画)
- **状态管理**: **Zustand** (轻量且高性能)

## 3. 基础设施 (Infrastructure)
- **数据库**: **PostgreSQL** (主存储) + **Redis** (缓存与任务队列)
- **实时通信**: **WebSockets (Elysia)**
- **视频处理**: **FFmpeg (fluent-ffmpeg)** + **Canvas API** (用于前端视频预览)
- **容器化**: **Docker + Docker Compose**

## 4. 开发流 (Dev Workflow)
- **包管理**: Bun
- **代码质量**: ESLint + Prettier
- **文档**: Context7 API 文档集成
