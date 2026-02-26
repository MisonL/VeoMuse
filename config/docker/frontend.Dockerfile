# config/docker/frontend.Dockerfile
FROM nginx:alpine

# 直接拷贝宿主机已编译好的产物
COPY apps/frontend/dist /usr/share/nginx/html
COPY config/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
