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

**VeoMuse** 是一款革命性的 AI 视频生成工具，基于 Google 最先进的 Gemini Veo 模型打造。v2.0 版本带来了全新的 **Liquid Glass (流体玻璃)** UI 设计，支持批量任务处理、提示词模板系统以及强大的视频后处理功能。

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

### 安装步骤

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

5. 访问 `http://localhost:5173` (开发模式) 或 `http://localhost:3000` (生产模式)

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

<p align="center">
  <strong>🎬 AI视频生成神器 | 基于Google Gemini Veo模型</strong>
</p>

<p align="center">
  <em>将文字和图片转化为精彩视频，让创意触手可及</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
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

**VeoMuse** 是一款革命性的 AI 视频生成工具，基于 Google 最先进的 Gemini Veo 模型打造。无论您是内容创作者、设计师还是开发者，都可以轻松地将文字描述或图片转化为高质量的视频内容。

🎆 **为什么选择 VeoMuse？**

- ✨ **简单易用**：输入文字或上传图片，一键生成视频
- 🚀 **快速部署**：支持 Docker、Vercel、Railway 等多种部署方式
- 🎨 **多样化**：支持多种视频风格和提示词模板
- ⚡ **高性能**：GPU 加速 + 智能轮询 + 批量处理
- 🔒 **企业级**：完整的安全防护和日志系统

> ⚠️ **重要提示**：Gemini Veo 模型目前仅在付费层级可用，免费层级的 API 密钥无法使用此功能。您需要一个有效的付费 API 密钥才能生成视频。

## ✨ 功能特点

### 核心功能

- 📝 **文字生成视频**：输入文字描述，自动生成相关视频内容
- 🖼️ **图片生成视频**：上传图片，生成基于图片的视频内容
- 🚫 **负面提示支持**：指定不希望在视频中出现的内容
- 🔑 **多 API 密钥支持**：支持配置多个 API 密钥，自动轮转
- ⏱️ **临时 API 密钥**：支持在 Web 界面临时输入 API 密钥（非持久化）

### 视频处理

- ▶️ **视频在线预览**：生成完成后可直接在浏览器中预览视频
- 🔄 **视频转码功能**：支持多种格式（MP4、WebM、MOV）和分辨率选择
- 💾 **视频下载功能**：一键下载生成的视频

### 用户体验

- 🌗 **深色/浅色主题切换**：适应不同使用环境
- 📱 **响应式设计**：支持桌面和移动设备
- 🖼️ **图片点击预览**：上传的图片可点击查看大图
- 📈 **实时生成状态显示**：清晰展示视频生成进度
- 🧠 **AI 提示词优化**：自动生成更优质的提示词

### 技术特性

- ⚡ **GPU 加速支持**：自动检测并使用 NVIDIA、Intel、AMD GPU 加速
- 🧹 **自动文件清理**：定期清理过期文件释放存储空间
- 🔧 **模块化架构**：易于维护和扩展的代码结构

## 🛠️ 技术栈

- **后端架构**：Node.js + Express（MVC 模式）
- **前端**：HTML5 + CSS3 + Vanilla JavaScript（模块化）
- **文件处理**：Multer
- **HTTP 客户端**：Axios
- **视频生成**：Google Gemini Veo API
- **视频处理**：FFmpeg + GPU 加速
- **实时通信**：Socket.IO
- **安全中间件**：多层安全防护、请求限流、IP 黑名单
- **日志系统**：Winston 结构化日志
- **测试框架**：Jest
- **身份认证**：JWT + bcryptjs
- **缓存服务**：Redis（可选）

## 🚀 快速开始

### 🚀 部署选项

> **注意**：VeoMuse 是一个全栈应用，需要 Node.js 后端支持，**不能**直接部署到 GitHub Pages。

推荐的部署方式：

1. **Vercel/Netlify**（推荐）

   - 支持 Serverless Functions
   - 免费额度充足
   - 自动 CI/CD

2. **Railway/Render**

   - 完整的 Node.js 环境
   - 一键部署
   - 免费层可用

3. **Docker + 云服务器**
   - 使用项目中的 Docker 配置
   - 适合生产环境

详细部署指南请查看 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

### 💻 本地安装

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0
- 有效的 Google Gemini API 密钥（付费层级）

### 安装步骤

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

   然后编辑 `.env` 文件，填入您的 Gemini API 密钥

4. 启动服务器：

   ```bash
   npm start
   ```

   或者在开发模式下运行：

   ```bash
   npm run dev
   ```

5. 在浏览器中访问 `http://localhost:3000`

## 📁 项目结构

```
VeoMuse/
├── server.js          # 服务器入口文件（MVC架构）
├── config.js          # 应用配置文件
├── package.json       # 项目配置文件
├── .env.example       # 环境变量示例文件
├── .env               # 环境变量配置文件
├── src/               # 源代码目录（模块化架构）
│   ├── app.js         # 应用主类
│   ├── routes/        # 路由模块
│   ├── controllers/   # 控制器模块
│   ├── services/      # 业务服务模块
│   └── middleware/    # 中间件模块
├── public/            # 静态文件目录
│   ├── index.html     # 主页面
│   ├── css/           # 样式文件
│   └── js/            # JavaScript模块
├── uploads/           # 上传文件目录
├── generated/         # 生成的视频文件目录
├── tests/             # 测试文件目录
├── config/            # 配置文件目录
│   ├── docker/        # Docker配置
│   │   ├── Dockerfile # Docker容器配置
│   │   ├── docker-compose.yml # Docker编排配置
│   │   └── .dockerignore # Docker忽略文件
│   ├── pm2/           # PM2配置
│   │   └── ecosystem.config.js # PM2生产环境配置
│   └── nginx/         # Nginx配置
│       └── nginx.conf # Nginx配置文件
├── docs/              # 文档目录
│   ├── API_DOCUMENTATION.md # API接口文档
│   └── DEPLOYMENT.md  # 部署指南
├── scripts/           # 脚本目录
│   └── deploy.sh      # 部署脚本
├── .github/           # GitHub Actions部署配置
└── README.md          # 项目说明文件
```

## 🎯 使用指南

### API 密钥配置

1. **临时 API 密钥**：在 Web 界面的顶部输入框中输入 API 密钥，仅在当前会话中有效
2. **持久化 API 密钥**：
   - 在 `.env` 文件中设置 `GEMINI_API_KEYS`（逗号分隔多个密钥）
   - 当一个密钥的配额用完时，系统会自动轮转到下一个密钥

### 文字生成视频

1. 在"文字生成视频"选项卡中输入详细的文字描述
2. （可选）在负面提示中添加不希望出现的内容描述
3. 点击"生成视频"按钮
4. 等待视频生成完成，可在页面中直接预览

### 图片生成视频

1. 切换到"图片生成视频"选项卡
2. 点击"选择文件"上传一张图片
3. 在图片描述中添加关于如何基于图片生成视频的详细提示
4. （可选）在负面提示中添加不希望出现的内容描述
5. 点击"生成视频"按钮
6. 等待视频生成完成，可在页面中直接预览

### 视频处理

1. 生成完成后，可选择不同的视频格式（MP4、WebM、MOV）
2. 可选择不同的分辨率（720p、1080p）
3. 点击"转码视频"按钮进行转码
4. 点击"下载视频"按钮下载视频文件

## 🤖 Gemini Veo API 集成

根据 Google 官方文档，Veo 3 是 Google 的先进模型，可根据文本提示生成高保真 720p 视频，时长为 8 秒，具有出色的逼真效果和原生生成的音频。

### 支持的功能

- 文字到视频生成
- 图片到视频生成
- 负面提示（negativePrompt）
- 视频参数控制（宽高比等）
- 异步操作轮询
- 多 API 密钥自动轮转

### API 配置

要使用真实的视频生成功能，您需要：

1. 在 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取 API 密钥
2. **重要**：确保您的项目已启用付费功能，否则将无法使用 Veo 模型
3. 将 API 密钥添加到 `.env` 文件中：
   ```
   # 多个密钥（逗号分隔）
   GEMINI_API_KEYS=key1,key2,key3
   ```

## 🎨 提示词编写指南

为了获得最佳效果，请在提示中包含以下元素：

- **正文**：您希望在视频中呈现的对象、人物、动物或场景
- **动作**：正文正在执行的动作
- **风格**：使用特定的电影风格关键字或动画风格
- **相机定位和运动**：如航拍、平视、俯拍等
- **构图**：如广角镜头、特写镜头等
- **对焦和镜头效果**：如浅景深、柔焦等
- **氛围**：颜色和光线对场景的贡献

### 负面提示

使用负面提示来指定您不希望在视频中出现的内容：

- 不要使用"不"或"没有"等否定词
- 直接描述您不想看到的内容，如"卡通、低质量、模糊"

## 🖥️ GPU 加速支持

应用程序自动检测并使用可用的 GPU 进行视频处理加速：

- **NVIDIA GPU**：使用 h264_nvenc 编码器
- **Intel GPU**：使用 h264_qsv 编码器
- **AMD GPU**：使用 h264_amf 编码器
- **CPU 回退**：当无 GPU 可用时自动使用 CPU 编码

## 🚀 部署

### 快速部署

```bash
# Docker部署（推荐）
cd config/docker && docker-compose up -d

# 或本地部署
npm start
```

详细部署说明请参考 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 🧪 测试

运行单元测试：

```bash
npm test
```

运行测试并监视文件变化：

```bash
npm run test:watch
```

生成测试覆盖率报告：

```bash
npm run test:coverage
```

## 📚 API 文档

详细的 API 接口文档请查看 [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) 文件。

## ⚠️ 注意事项

- Gemini Veo 是 Google 最新的视频生成模型，需要有效的付费 API 密钥才能使用
- 视频生成是一个计算密集型任务，可能需要几分钟时间
- 生成的视频会在服务器上存储 2 天，之后会被移除
- 应用程序包含完整的错误处理和用户反馈机制
- API 密钥配额用完时会自动轮转到下一个可用密钥

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

1. Fork 项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- 感谢 Google 提供的强大 Gemini Veo 模型
- 感谢所有开源库的贡献者们

---

<p align="center">
  Made with ❤️ by Developers
</p>
