# VeoMuse Dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装FFmpeg和其他系统依赖
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

# 复制package文件
COPY package*.json ./

# 安装Node.js依赖
RUN npm ci --only=production

# 创建必要的目录
RUN mkdir -p uploads generated logs

# 复制应用代码
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S veomuse -u 1001

# 设置目录权限
RUN chown -R veomuse:nodejs /app
USER veomuse

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动应用（使用重构后的MVC架构）
CMD ["npm", "start"]