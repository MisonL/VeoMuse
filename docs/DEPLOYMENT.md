# VeoMuse 部署指南

## 🚀 快速部署

### Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/MisonL/VeoMuse.git
cd VeoMuse

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入您的API密钥

# 启动服务
npm run docker:compose
```

### 本地部署

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 构建前端
npm run build

# 启动服务
npm start
```

### 生产环境部署

```bash
# 构建前端
npm run build

# 使用PM2
npm install -g pm2
npm run pm2:start

# 查看状态
pm2 status
```

## ⚙️ 环境变量配置

关键配置项：

| 变量名           | 说明                   | 必需           |
| ---------------- | ---------------------- | -------------- |
| `GEMINI_API_KEY` | Google Gemini API 密钥 | ✅             |
| `JWT_SECRET`     | JWT 签名密钥           | ✅             |
| `PORT`           | 应用端口               | ❌ (默认 5173) |
| `NODE_ENV`       | 环境模式               | ❌             |

## 🔍 健康检查

部署完成后验证：

```bash
# 健康检查
curl http://localhost:5173/health

# 访问应用
curl http://localhost:5173
```

## ❓ 常见问题

**Q: Docker 启动失败**
A: 检查端口占用和环境变量配置

**Q: API 调用失败**
A: 确认 API 密钥有效且为付费账户

**Q: 视频生成失败**
A: 检查 FFmpeg 安装和磁盘空间

## 🐳 Docker 部署

### 单容器部署

1. **构建镜像**

   ```bash
   npm run docker:build
   ```

2. **运行容器**
   ```bash
   npm run docker:run
   ```

### Docker Compose 部署

1. **生产环境**

   ```bash
   npm run docker:compose
   ```

2. **开发环境**
   ```bash
   npm run docker:compose:dev
   ```

### 配置说明

- **主应用**: 端口 5173
- **Redis 缓存**: 端口 6379
- **Nginx 代理**: 端口 80/443

## 🚀 快速部署

### Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/MisonL/VeoMuse.git
cd VeoMuse

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入您的API密钥

# 启动服务
npm run docker:compose
```

### 本地部署

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动服务
npm start
```

### 生产环境部署

```bash
# 使用PM2
npm install -g pm2
npm run pm2:start

# 查看状态
pm2 status
```

## ⚙️ 环境变量配置

关键配置项：

| 变量名           | 说明                   | 必需 |
| ---------------- | ---------------------- | ---- |
| `GEMINI_API_KEY` | Google Gemini API 密钥 | ✅   |
| `JWT_SECRET`     | JWT 签名密钥           | ✅   |
| `PORT`           | 应用端口               | ❌   |
| `NODE_ENV`       | 环境模式               | ❌   |

## 🔍 健康检查

部署完成后验证：

```bash
# 健康检查
curl http://localhost:3000/health

# 访问应用
curl http://localhost:3000
```

## ❓ 常见问题

**Q: Docker 启动失败**
A: 检查端口占用和环境变量配置

**Q: API 调用失败**
A: 确认 API 密钥有效且为付费账户

**Q: 视频生成失败**
A: 检查 FFmpeg 安装和磁盘空间

## 🐳 Docker 部署

### 单容器部署

1. **构建镜像**

   ```bash
   npm run docker:build
   ```

2. **运行容器**
   ```bash
   npm run docker:run
   ```

### Docker Compose 部署

1. **生产环境**

   ```bash
   npm run docker:compose
   ```

2. **开发环境**
   ```bash
   npm run docker:compose:dev
   ```

### 配置说明

- **主应用**: 端口 3000
- **Redis 缓存**: 端口 6379
- **Nginx 代理**: 端口 80/443

## 🔧 手动部署

### 1. 环境准备

```bash
# 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装FFmpeg
sudo apt update
sudo apt install ffmpeg

# 安装PM2（可选）
npm install -g pm2
```

### 2. 项目部署

```bash
# 克隆项目
git clone https://github.com/用户名/VeoMuse.git
cd VeoMuse

# 安装依赖
npm ci --only=production

# 配置环境变量
cp .env.example .env
# 编辑.env文件，填入实际配置

# 启动应用
npm start

# 或使用PM2
pm2 start ecosystem.config.js
```

## ⚙️ 环境变量配置

### 必需配置

| 变量名           | 说明                   | 示例                    |
| ---------------- | ---------------------- | ----------------------- |
| `GEMINI_API_KEY` | Google Gemini API 密钥 | `AIza...`               |
| `VEO_API_KEY`    | VEO API 密钥           | `veo_...`               |
| `JWT_SECRET`     | JWT 签名密钥           | `random_32_char_string` |

### 可选配置

| 变量名          | 默认值        | 说明                   |
| --------------- | ------------- | ---------------------- |
| `PORT`          | `3000`        | 应用端口               |
| `NODE_ENV`      | `development` | 环境模式               |
| `MAX_FILE_SIZE` | `10485760`    | 最大上传文件大小(字节) |
| `LOG_LEVEL`     | `info`        | 日志级别               |

### 配置文件

- **开发环境**: `.env`
- **生产环境**: `.env.production`
- **示例配置**: `.env.example`

## 🔍 部署验证

### 健康检查

部署完成后，访问以下端点验证服务状态：

```bash
# 应用健康检查
curl http://localhost:3000/health

# API状态检查
curl http://localhost:3000/api/status
```

### 功能测试

1. **访问主页**: `http://localhost:3000`
2. **测试 API**: 使用 API 文档中的示例请求
3. **查看日志**: 检查 `logs/` 目录下的日志文件

## ❓ 常见问题

### GitHub Pages 相关

**Q: GitHub Pages 显示 404 错误**
A: 确保以下设置正确：

- Repository 必须是 public（或 GitHub Pro 账户）
- Pages source 设置为"GitHub Actions"
- 工作流执行成功

**Q: 部署失败，显示权限错误**
A: 检查以下权限设置：

- `Settings` > `Actions` > `General` > Workflow permissions
- 选择 "Read and write permissions"

### Docker 相关

**Q: Docker 构建失败**
A: 常见原因：

- 确保 Docker 已正确安装
- 检查网络连接
- 清理 Docker 缓存：`docker system prune`

**Q: 容器启动失败**
A: 检查以下项目：

- 环境变量配置是否正确
- 端口是否被占用
- 查看容器日志：`docker logs 容器名`

### API 相关

**Q: Gemini API 调用失败**
A: 检查：

- API 密钥是否有效
- API 配额是否用完
- 网络连接是否正常

**Q: 视频生成失败**
A: 可能原因：

- FFmpeg 未正确安装
- 上传文件格式不支持
- 磁盘空间不足

## 📞 技术支持

如遇到部署问题，请：

1. 查看项目日志文件
2. 检查 GitHub Actions 执行日志
3. 参考 API 文档和错误代码
4. 在 GitHub Issues 中提交问题

## 📝 更新日志

- `2025-01-XX`: 添加 GitHub Pages 自动部署支持
- `2025-01-XX`: 完善 Docker 容器化配置
- `2025-01-XX`: 增加部署验证和监控

---

📧 如有问题，欢迎提交 Issue 或联系维护团队。
