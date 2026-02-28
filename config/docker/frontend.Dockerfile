FROM oven/bun:1.3.9 AS builder
WORKDIR /app

# 先复制依赖元数据，利用 Docker 缓存
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN bun install

# 再复制完整源码并构建前端
COPY . .
RUN bun run --cwd apps/frontend build

FROM nginx:alpine
COPY config/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 18081
CMD ["nginx", "-g", "daemon off;"]
