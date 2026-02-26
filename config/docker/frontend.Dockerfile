# 极致可靠模式：直接使用宿主机已经构建好的产物
FROM nginx:alpine

# 1. 物理复制本地生成的 dist 产物
COPY apps/frontend/dist /usr/share/nginx/html

# 2. 复制 Nginx 配置文件
COPY config/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
