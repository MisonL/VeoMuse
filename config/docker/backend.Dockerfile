# config/docker/backend.Dockerfile
# Stage 1: Build
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

# 拷贝根目录依赖定义
COPY package.json bun.lock ./
COPY tsconfig.json ./

# 拷贝后端代码
COPY apps/backend ./apps/backend
COPY packages ./packages

# 安装依赖并构建
RUN bun install --frozen-lockfile
WORKDIR /app/apps/backend
# 确保类型安全检查通过或执行构建逻辑（若有）

# Stage 2: Runtime
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

# 安装 FFmpeg (生产环境必备)
RUN apk add --no-cache ffmpeg

# 从 Build 阶段拷贝产物
COPY --from=builder /app /app

EXPOSE 3001
ENV NODE_ENV=production

CMD ["bun", "run", "apps/backend/src/index.ts"]
