# Specification: 旗舰版商业化上线计划

## 目标
将 VeoMuse 从开发环境迁移至标准的云原生生产架构，实现高可用、可扩展的容器化部署。

## 关键技术要求
- **容器化**: Docker (Oven/Bun 镜像为基底)。
- **反向代理**: Nginx (OpenResty 兼容)。
- **静态部署**: 前端导出为 SPA 静态包由 Nginx 托管。
- **环境隔离**: 使用 Docker Network 隔离内网服务。

## 预期产出
- `Dockerfile` & `docker-compose.yml`。
- `nginx.conf`。
- `DEPLOYMENT.md` 生产操作手册。
