#!/bin/bash

# VeoMuse 一键部署脚本
# 使用方法: ./deploy.sh [模式]
# 模式: pages, docker, pm2, local

set -e

echo "🚀 VeoMuse 部署脚本"
echo "==================="

# 检查参数
if [ $# -eq 0 ]; then
    echo "请指定部署模式:"
    echo "  pages  - GitHub Pages 部署"
    echo "  docker - Docker 容器部署"
    echo "  pm2    - PM2 生产环境部署"
    echo "  local  - 本地开发部署"
    echo ""
    echo "使用方法: ./deploy.sh [模式]"
    exit 1
fi

MODE=$1

# 公共检查函数
check_dependencies() {
    echo "📋 检查依赖..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm 未安装"
        exit 1
    fi
    
    echo "✅ 基础依赖检查完成"
}

# 安装依赖
install_dependencies() {
    echo "📦 安装项目依赖..."
    npm ci
    echo "✅ 依赖安装完成"
}

# GitHub Pages 部署
deploy_pages() {
    echo "🌐 开始 GitHub Pages 部署..."
    
    # 检查git仓库
    if [ ! -d ".git" ]; then
        echo "❌ 当前目录不是git仓库"
        exit 1
    fi
    
    # 构建文档
    echo "📖 构建文档..."
    npm run build:docs
    
    # 提交更改
    echo "📤 提交更改到GitHub..."
    git add .
    git commit -m "feat: 更新GitHub Pages部署配置" || echo "没有新的更改需要提交"
    git push origin main
    
    echo "✅ GitHub Pages 部署已触发"
    echo "📱 部署完成后可访问: https://$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\)\/\([^.]*\).*/\1.github.io\/\2/')"
}

# Docker 部署
deploy_docker() {
    echo "🐳 开始 Docker 部署..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    # 检查环境变量文件
    if [ ! -f ".env" ]; then
        echo "⚠️  .env 文件不存在，使用示例配置"
        cp .env.example .env
        echo "📝 请编辑 .env 文件配置API密钥等信息"
    fi
    
    # 构建和启动
    echo "🔨 构建Docker镜像..."
    docker-compose down 2>/dev/null || true
    docker-compose up -d --build
    
    # 健康检查
    echo "🔍 等待服务启动..."
    sleep 10
    
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Docker 部署成功"
        echo "🌐 应用地址: http://localhost:3000"
        echo "📊 查看日志: docker-compose logs -f"
    else
        echo "❌ Docker 部署失败"
        docker-compose logs
        exit 1
    fi
}

# PM2 部署
deploy_pm2() {
    echo "⚡ 开始 PM2 生产环境部署..."
    
    # 检查PM2
    if ! command -v pm2 &> /dev/null; then
        echo "📦 安装 PM2..."
        npm install -g pm2
    fi
    
    # 检查环境变量
    if [ ! -f ".env" ]; then
        echo "⚠️  .env 文件不存在，使用生产环境配置"
        cp .env.production .env
        echo "📝 请编辑 .env 文件配置API密钥等信息"
        read -p "按回车键继续..." -r
    fi
    
    # 停止现有进程
    pm2 delete veomuse 2>/dev/null || echo "没有运行中的进程需要停止"
    
    # 启动应用
    npm run pm2:start
    
    # 保存PM2配置
    pm2 save
    pm2 startup
    
    echo "✅ PM2 部署成功"
    echo "🌐 应用地址: http://localhost:3000"
    echo "📊 查看状态: pm2 status"
    echo "📝 查看日志: pm2 logs veomuse"
}

# 本地开发部署
deploy_local() {
    echo "💻 开始本地开发部署..."
    
    # 检查环境变量
    if [ ! -f ".env" ]; then
        echo "📝 创建开发环境配置..."
        cp .env.example .env
        echo "请编辑 .env 文件配置API密钥等信息"
    fi
    
    # 启动开发服务器
    echo "🔄 启动开发服务器..."
    npm run dev
}

# 部署后验证
verify_deployment() {
    if [ "$MODE" != "pages" ] && [ "$MODE" != "local" ]; then
        echo "🔍 验证部署..."
        sleep 5
        
        if curl -f http://localhost:3000/health &> /dev/null; then
            echo "✅ 服务健康检查通过"
        else
            echo "⚠️  服务健康检查失败，请检查日志"
        fi
    fi
}

# 主执行流程
main() {
    check_dependencies
    
    case $MODE in
        "pages")
            install_dependencies
            deploy_pages
            ;;
        "docker")
            deploy_docker
            verify_deployment
            ;;
        "pm2")
            install_dependencies
            deploy_pm2
            verify_deployment
            ;;
        "local")
            install_dependencies
            deploy_local
            ;;
        *)
            echo "❌ 未知的部署模式: $MODE"
            echo "支持的模式: pages, docker, pm2, local"
            exit 1
            ;;
    esac
    
    echo ""
    echo "🎉 部署完成！"
    echo "📖 更多信息请查看 DEPLOYMENT.md"
}

# 执行主函数
main