# config/docker/backend.Dockerfile
FROM oven/bun:1.3.9
WORKDIR /app

# 1. 安装系统级依赖
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# 2. 拷贝后端及共享包
COPY package.json bun.lock ./
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

# 3. 在后端目录显式安装，强制生成本地 node_modules 消除路径偏差
WORKDIR /app/apps/backend
RUN bun install

EXPOSE 33117
ENV NODE_ENV=production

# 4. 直接启动
CMD ["bun", "run", "src/index.ts"]
