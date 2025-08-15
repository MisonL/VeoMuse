<h1 align="center">VeoMuse</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/Gemini-FF6B6B?style=for-the-badge&logo=google&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white" alt="FFmpeg">
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/yourusername/veomuse" alt="License">
  <img src="https://img.shields.io/github/languages/top/yourusername/veomuse" alt="Language">
  <img src="https://img.shields.io/github/last-commit/yourusername/veomuse" alt="Last Commit">
</p>

<p align="center">
  <strong>使用Google Gemini Veo模型将文字或图片生成视频的Web应用程序</strong>
</p>

<p align="center">
  <img src="https://github.com/MisonL/veomuse/blob/main/screenshot.png?raw=true" alt="VeoMuse界面截图" width="800">
</p>

## 🌟 简介

VeoMuse是一个基于Google Gemini Veo模型的文字/图片生成视频的应用程序。用户可以通过简单的Web界面输入文字描述或上传图片，应用程序会调用Gemini Veo模型生成相应的视频。

> ⚠️ **重要提示**：Gemini Veo模型目前仅在付费层级可用，免费层级的API密钥无法使用此功能。您需要一个有效的付费API密钥才能生成视频。

## ✨ 功能特点

### 核心功能
- 📝 **文字生成视频**：输入文字描述，自动生成相关视频内容
- 🖼️ **图片生成视频**：上传图片，生成基于图片的视频内容
- 🚫 **负面提示支持**：指定不希望在视频中出现的内容
- 🔑 **多API密钥支持**：支持配置多个API密钥，自动轮转
- ⏱️ **临时API密钥**：支持在Web界面临时输入API密钥（非持久化）

### 视频处理
- ▶️ **视频在线预览**：生成完成后可直接在浏览器中预览视频
- 🔄 **视频转码功能**：支持多种格式（MP4、WebM、MOV）和分辨率选择
- 💾 **视频下载功能**：一键下载生成的视频

### 用户体验
- 🌗 **深色/浅色主题切换**：适应不同使用环境
- 📱 **响应式设计**：支持桌面和移动设备
- 🖼️ **图片点击预览**：上传的图片可点击查看大图
- 📈 **实时生成状态显示**：清晰展示视频生成进度
- 🧠 **AI提示词优化**：自动生成更优质的提示词

### 技术特性
- ⚡ **GPU加速支持**：自动检测并使用NVIDIA、Intel、AMD GPU加速
- 🧹 **自动文件清理**：定期清理过期文件释放存储空间
- 🔧 **模块化架构**：易于维护和扩展的代码结构

## 🛠️ 技术栈

- **后端**：Node.js + Express
- **前端**：HTML5 + CSS3 + Vanilla JavaScript
- **文件处理**：Multer
- **HTTP客户端**：Axios
- **视频生成**：Google Gemini Veo API
- **视频处理**：FFmpeg + GPU加速
- **实时通信**：Socket.IO

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0
- 有效的Google Gemini API密钥（付费层级）

### 安装步骤

1. 克隆项目到本地：
   ```bash
   git clone https://github.com/yourusername/veomuse.git
   cd veomuse
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 配置环境变量：
   ```bash
   cp .env.example .env
   ```
   然后编辑 `.env` 文件，填入您的Gemini API密钥

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
├── server.js          # 服务器主文件
├── config.js          # 应用配置文件
├── package.json       # 项目配置文件
├── .env.example       # 环境变量示例文件
├── .env               # 环境变量配置文件
├── public/            # 静态文件目录
│   └── index.html     # 主页面
├── uploads/           # 上传文件目录
├── generated/         # 生成的视频文件目录
├── tests/             # 测试文件目录
├── API_DOCUMENTATION.md # API文档
└── README.md          # 项目说明文件
```

## 🎯 使用指南

### API密钥配置

1. **临时API密钥**：在Web界面的顶部输入框中输入API密钥，仅在当前会话中有效
2. **持久化API密钥**：
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

## 🤖 Gemini Veo API集成

根据Google官方文档，Veo 3是Google的先进模型，可根据文本提示生成高保真720p视频，时长为8秒，具有出色的逼真效果和原生生成的音频。

### 支持的功能

- 文字到视频生成
- 图片到视频生成
- 负面提示（negativePrompt）
- 视频参数控制（宽高比等）
- 异步操作轮询
- 多API密钥自动轮转

### API配置

要使用真实的视频生成功能，您需要：

1. 在 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取API密钥
2. **重要**：确保您的项目已启用付费功能，否则将无法使用Veo模型
3. 将API密钥添加到 `.env` 文件中：
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

## 🖥️ GPU加速支持

应用程序自动检测并使用可用的GPU进行视频处理加速：

- **NVIDIA GPU**：使用h264_nvenc编码器
- **Intel GPU**：使用h264_qsv编码器
- **AMD GPU**：使用h264_amf编码器
- **CPU回退**：当无GPU可用时自动使用CPU编码

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

## 📚 API文档

详细的API接口文档请查看 [API_DOCUMENTATION.md](API_DOCUMENTATION.md) 文件。

## ⚠️ 注意事项

- Gemini Veo是Google最新的视频生成模型，需要有效的付费API密钥才能使用
- 视频生成是一个计算密集型任务，可能需要几分钟时间
- 生成的视频会在服务器上存储2天，之后会被移除
- 应用程序包含完整的错误处理和用户反馈机制
- API密钥配额用完时会自动轮转到下一个可用密钥

## 🤝 贡献

欢迎提交Issue和Pull Request来帮助改进这个项目！

1. Fork 项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- 感谢Google提供的强大Gemini Veo模型
- 感谢所有开源库的贡献者们

---

<p align="center">
  Made with ❤️ by Developers
</p>