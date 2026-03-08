# config/docker/backend.Dockerfile
FROM oven/bun:1.3.9
WORKDIR /app

# 1. 安装系统级依赖
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# 2. 先拷贝依赖元数据，确保 workspace 锁一致
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# 3. 仅安装后端运行时依赖，避免在镜像内重复拉取整仓 dev 工具链
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --production --filter '@veomuse/backend'

# 4. 拷贝后端与共享源码
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

WORKDIR /app/apps/backend

EXPOSE 33117
ENV NODE_ENV=production

# 5. 直接启动
CMD ["bun", "run", "src/index.ts"]
