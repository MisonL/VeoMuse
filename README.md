# VeoMuse V3.1 Pro 旗舰版

> **以工匠之心，铸 AI 之魂。**

VeoMuse 是一款专注于 **Gemini Veo** 模型的顶级工业级 AI 视频创作平台。它通过极致的 **Obsidian Pro (黑曜石)** 视觉语言，将强大的多模型生成能力转化为简单、直观且高效的生产力工具。

## 💎 旗舰特性 (V3.1 Pro)

- **Master Grid 工业布局**：严格对齐 Apple Pro 规范的三段式均衡架构，具备 16px 物理圆角与 12px 呼吸间距。
- **100% 蓝图闭环**：完整集成 AI 一键导演、多模型实时实验室、3D NeRF 空间预览及 AI 媒体炼金术。
- **Native SyncController**：摒弃 React 渲染压力，通过原生驱动实现 60fps 丝滑多轨播放与预览。
- **全链路遥测看板**：实时物理抓取 GPU 负载、RAM 占用及缓存状态，指标每 2 秒物理跳动。
- **专业级 NLE 增强**：支持全局快捷键总线、磁吸感对齐线、Beat 节奏感应及 Zundo 撤销重做系统。
- **工业级全栈架构**：Bun Monorepo + ElysiaJS + React 19 + Eden Treaty (100% 类型同步)。

## 🛠️ 快速启动

```bash
# 安装依赖
bun install

# 拉起全栈开发环境 (Backend: 33117, Frontend: 42873)
bun run dev

# 生产构建
bun run build

# macOS / Linux 一键生产部署
bun run deploy:oneclick

# Windows PowerShell 一键生产部署
bun run deploy:oneclick:win
```

## ✅ 质量命令

```bash
# 后端与共享类型检查
bun run lint

# 全量回归测试
bun test

# 敏感信息扫描（轻量）
bun run security:scan

# 安装 pre-push 安全钩子
bun run hooks:install
```

## 🏗️ 仓库结构

- `apps/backend`: 工业级 AI 路由总线 (Elysia)。
- `apps/frontend`: 旗舰版编辑器 UI (React 19)。
- `packages/shared`: 100% E2E 类型定义与工具。
- `conductor/`: 项目规格说明与执行计划存档。

## 🚀 三平台一键部署

- `macOS`: `bash scripts/one-click-deploy.sh`
- `Linux`: `bash scripts/one-click-deploy.sh`
- `Windows`: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/one-click-deploy.ps1`

脚本能力：
- 自动创建或修复 `.env` 必需安全变量（`JWT_SECRET`、`SECRET_ENCRYPTION_KEY`、`ADMIN_TOKEN`、`REDIS_PASSWORD`）。
- 自动执行 `docker compose up -d --build` 并等待健康检查通过。
- 输出访问地址与常用运维命令（停止、日志）。

---
**VeoMuse V3.1 Pro - 开启 AI 视频创作新纪元。**
