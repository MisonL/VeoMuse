<h1 align="center">VeoMuse</h1>

<p align="center">
  <strong>🎬 AI视频生成神器 | 基于Google Gemini Veo模型</strong>
</p>

<p align="center">
  <em>将文字和图片转化为精彩视频，让创意触手可及</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/Gemini-FF6B6B?style=for-the-badge&logo=google&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white" alt="FFmpeg">
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/MisonL/VeoMuse" alt="License">
  <img src="https://img.shields.io/github/languages/top/MisonL/VeoMuse" alt="Language">
  <img src="https://img.shields.io/github/last-commit/MisonL/VeoMuse" alt="Last Commit">
  <img src="https://img.shields.io/github/stars/MisonL/VeoMuse?style=social" alt="Stars">
</p>

<p align="center">
  <a href="#快速开始">📖 快速开始</a> |
  <a href="docs/API_DOCUMENTATION.md">🔌 API文档</a> |
  <a href="docs/DEPLOYMENT.md">🐳 部署指南</a>
</p>

---

<p align="center">
  <strong>使用Google Gemini Veo模型将文字或图片生成视频的Web应用程序</strong>
</p>

<p align="center">
  <img src="https://github.com/MisonL/VeoMuse/blob/main/screenshot.png?raw=true" alt="VeoMuse界面截图" width="800">
</p>

## 🌟 简介

**VeoMuse** 是一款革命性的 AI 视频生成工具，基于 Google 最先进的 **Veo 3.1** 模型打造。v3.0 版本带来了全新的 **Liquid Glass (流体玻璃)** UI 设计，支持批量任务处理、提示词模板系统以及强大的视频后处理功能。

🎆 **为什么选择 VeoMuse？**

- ✨ **极致体验**：全新的流体玻璃拟态 UI，支持平滑的深色模式切换
- 🚀 **批量生产**：支持批量生成任务，自动队列管理，效率倍增
- 🎨 **创意辅助**：内置丰富的提示词模板，支持 AI 智能优化提示词
- ⚡ **全能处理**：集成了视频转码、GIF 生成、封面截取等一站式后处理功能
- 🌍 **国际化**：原生支持中英文切换 (I18n)

> ⚠️ **重要提示**：Gemini Veo 模型目前仅在付费层级可用，免费层级的 API 密钥无法使用此功能。您需要一个有效的付费 API 密钥才能生成视频。

## ✨ 功能特点

### 核心功能

- 📝 **文字生成视频**：输入文字描述，自动生成相关视频内容
- 🖼️ **图片生成视频**：上传图片，生成基于图片的视频内容
- 📦 **批量生成任务**：支持创建批量任务，后台自动队列处理，适合大规模生产
- 🧩 **提示词模板**：内置多种场景模板（社交媒体、产品展示等），支持自定义
- 🧠 **AI 提示词优化**：使用 Gemini 模型自动润色和优化您的提示词

### 视频后处理

- ▶️ **在线预览**：生成完成后直接在浏览器中预览
- 🔄 **格式转换**：支持 MP4, WebM, MOV 等格式互转
- 🎞️ **GIF 生成**：一键将视频转换为 GIF 动图
- 📸 **封面截取**：自动截取视频指定时间点的封面图
- ⬇️ **一键下载**：支持下载原始视频或处理后的文件

### 用户体验

- 💎 **Liquid Glass UI**：现代化的玻璃拟态设计，流畅的交互动画
- 🌗 **深色/浅色主题**：完美适配系统主题，支持手动切换
- 🌐 **多语言支持**：内置中英文语言包，一键切换
- 📱 **响应式设计**：完美适配桌面和移动端设备

## 🛠️ 技术栈

- **前端**：

  - **构建工具**：Vite
  - **核心**：Vanilla JS (ES Modules)
  - **样式**：CSS3 Variables, Glassmorphism
  - **交互**：Socket.IO Client

- **后端**：
  - **运行时**：Node.js + Express
  - **视频处理**：FFmpeg + Fluent-FFmpeg
  - **AI 集成**：Google Gemini API
  - **实时通信**：Socket.IO Server
  - **任务队列**：内存队列管理 (支持批量任务)

## 🚀 快速开始

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0
- 有效的 Google Gemini API 密钥（付费层级）

### 🐳 Docker 部署（推荐）

我们提供了规范化的 Docker 部署支持，一键启动所有服务。

1. 克隆项目并配置 `.env` 文件。
2. 运行启动命令：

   ```bash
   npm run docker:compose
   ```

   此命令将自动构建镜像并启动名为 `veomuse` 的容器组。

3. 访问 `http://localhost:5173`

### 📦 本地安装步骤

1. 克隆项目到本地：

   ```bash
   git clone https://github.com/MisonL/VeoMuse.git
   cd VeoMuse
   ```

2. 安装依赖：

   ```bash
   npm install
   ```

3. 配置环境变量：

   ```bash
   cp .env.example .env
   ```

   编辑 `.env` 文件，填入您的 `GEMINI_API_KEY`。

4. 启动开发服务器（同时启动前后端）：

   ```bash
   npm run dev
   ```

   或者启动生产模式：

   ```bash
   npm start
   ```

5. 访问 `http://localhost:5173`

## 📁 项目结构

```
VeoMuse/
├── src/               # 后端源代码
│   ├── app.js         # 应用入口
│   ├── routes/        # API 路由 (video, batch, prompts...)
│   ├── controllers/   # 控制器逻辑
│   ├── services/      # 业务服务 (BatchVideoService, TranscodeService...)
│   └── middleware/    # 中间件 (Auth, Security)
├── public/            # 前端源代码 (Vite 根目录)
│   ├── index.html     # 入口 HTML
│   ├── css/           # 样式文件 (style.css, features.css...)
│   └── js/            # JS 模块 (api.js, batch.js, ui.js...)
├── config/            # 配置文件
├── uploads/           # 上传文件临时目录
├── generated/         # 生成结果存储目录
├── vite.config.js     # Vite 配置
└── package.json       # 项目依赖
```

## 🎯 使用指南

### 批量任务

1. 进入"批量生成"标签页。
2. 选择一个模板分类（如"社交媒体"）。
3. 设置生成数量和模型。
4. 点击"创建任务"，系统将自动在后台队列中处理。
5. 您可以随时查看任务进度、成功/失败数量，并查看结果。

### 视频后处理

1. 视频生成成功后，预览窗口下方会出现工具栏。
2. 点击"转码"可转换格式。
3. 点击"GIF"可生成动图。
4. 点击"封面"可截取当前帧为图片。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

<p align="center">
  Made with ❤️ by Developers
</p>
