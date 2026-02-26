# config/docker/frontend.Dockerfile
# Stage 1: Build
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/frontend ./apps/frontend
COPY packages ./packages

RUN bun install --frozen-lockfile
WORKDIR /app/apps/frontend
RUN bun run vite build

# Stage 2: Serve
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
# 拷贝自定义 Nginx 配置
COPY config/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
