# VeoMuse 旗舰版 (V3.1 Pro) 生产部署手册

## 1. 架构架构概览 (Topology)
系统采用云原生微服务架构：
- **前端容器 (Nginx)**: 托管 Vite 8 编译后的 React 19 应用，提供反向代理与静态加速。
- **后端容器 (Bun/Elysia)**: 执行 AI 核心逻辑、模型调度与 FFmpeg 合成。
- **缓存层 (Redis)**: 管理任务状态与高频数据。
- **持久化卷**: 存储用户上传素材与生成的视频产物。

## 2. 快速启动 (Quick Start)
确保宿主机已安装 Docker 和 Docker Compose。

```bash
# 1. 拷贝环境变量模板并配置
cp .env.example .env

# 2. 启动全栈服务
cd config/docker
docker-compose up -d --build
```

## 3. 环境变量配置 (.env)
| 变量名 | 必填 | 描述 |
| :--- | :--- | :--- |
| `GEMINI_API_KEYS` | 是 | 多个 API Key 请用逗号分隔，系统将自动轮询。 |
| `PORT` | 否 | 后端服务端口，默认为 3001。 |
| `REDIS_HOST` | 否 | Docker 环境下默认为 `veomuse-redis`。 |

## 4. 目录挂载与持久化
生产环境下，请确保 `uploads/` 目录已被正确挂载，以防止容器重启导致视频丢失：
- `/app/uploads` -> 宿主机 `./uploads`

## 5. 运维与监控
- **查看日志**: `docker-compose logs -f veomuse-backend`
- **健康检查**: `GET http://<domain>/api/health`
- **更新版本**: `git pull && docker-compose up -d --build`

---
**VeoMuse 首席架构师签发**
