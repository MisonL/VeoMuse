# VeoMuse 旗舰版生产部署指南 (V3.1 Pro)

## 🚀 一键部署 (Recommended)

系统已完全容器化，只需两步即可拉起生产环境：

```bash
# 1. 填入 API 密钥
echo "GEMINI_API_KEYS=key1,key2" > .env

# 2. 启动集群
cd config/docker
docker-compose up -d --build
```

## 🏗️ 架构详情
- **Nginx**: 入口网关，负责 Gzip 压缩、静态资产强缓存及 WebSocket 转发。
- **Bun Backend**: 高性能运行时，执行 FFmpeg 物理合成与模型调度。
- **Redis**: 任务状态同步。

## ⚙️ 环境变量
| Key | Default | Note |
|---|---|---|
| `PORT` | 3001 | 后端端口 |
| `REDIS_HOST` | veomuse-redis | 内部通信 |
| `NODE_ENV` | production | 开启 Peak 稳定性模式 |

---
**VeoMuse - 工业级稳定性，旗舰级表现。**
