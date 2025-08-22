// src/app.js - 重构后的服务器主文件
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;

require('dotenv').config();

// 导入配置和服务
const config = require('../config');
const routes = require('./routes');
const SocketService = require('./services/SocketService');

class App {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.init();
  }

  async init() {
    // 创建必要目录
    await this.createDirectories();
    
    // 设置中间件
    this.setupMiddleware();
    
    // 设置路由
    this.setupRoutes();
    
    // 初始化Socket服务
    this.setupSocket();
    
    // 设置定期清理
    this.setupCleanup();
    
    // 错误处理
    this.setupErrorHandling();
  }

  async createDirectories() {
    const dirs = [
      config.upload.uploadDir, 
      config.upload.generatedDir,
      'public'
    ];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
        console.log(`目录已存在: ${dir}`);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`创建目录: ${dir}`);
      }
    }
  }

  setupMiddleware() {
    const { corsOptions, basicSecurity } = require('./middleware/security');
    
    // CORS安全配置
    this.app.use(cors(corsOptions));
    
    // JSON解析
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // 基础安全中间件
    this.app.use(basicSecurity);
    
    // 静态文件服务
    this.app.use(express.static('public'));
    this.app.use('/generated', express.static(config.upload.generatedDir));
    this.app.use('/uploads', express.static(config.upload.uploadDir));
    
    // 请求日志
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // 使用路由模块
    this.app.use('/', routes);
    
    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: '接口不存在'
      });
    });
  }

  setupSocket() {
    // 初始化Socket服务
    SocketService.init(this.io);
  }

  setupCleanup() {
    const { securityService } = require('./middleware/security');
    
    // 定期清理过期文件
    const cleanupInterval = 60 * 60 * 1000; // 1小时
    setInterval(() => {
      this.cleanupOldFiles();
      securityService.cleanup(); // 清理安全服务数据
    }, cleanupInterval);
    
    // 启动时清理一次
    setTimeout(() => {
      this.cleanupOldFiles();
    }, 5000);
  }

  async cleanupOldFiles() {
    try {
      const now = Date.now();
      const maxAge = config.cleanup.maxFileAge;
      
      // 清理uploads目录
      await this.cleanupDirectory(config.upload.uploadDir, maxAge, now);
      
      // 清理generated目录  
      await this.cleanupDirectory(config.upload.generatedDir, maxAge, now);
      
    } catch (error) {
      console.error('文件清理失败:', error);
    }
  }

  async cleanupDirectory(dirPath, maxAge, now) {
    try {
      const files = await fs.readdir(dirPath);
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
          console.log(`清理过期文件: ${filePath}`);
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`${dirPath} 清理完成，删除 ${cleanedCount} 个文件`);
      }
    } catch (err) {
      console.log(`清理目录 ${dirPath} 失败:`, err.message);
    }
  }

  setupErrorHandling() {
    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      console.error('未捕获异常:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason);
    });

    // Express错误处理中间件
    this.app.use((error, req, res, next) => {
      console.error('Express错误:', error);
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: '文件大小超出限制'
        });
      }
      
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    });
  }

  start() {
    const PORT = config.server.port;
    
    this.server.listen(PORT, () => {
      console.log(`🚀 VeoMuse服务器已启动`);
      console.log(`📍 端口: ${PORT}`);
      console.log(`🌐 访问: http://localhost:${PORT}`);
      console.log(`📁 上传目录: ${config.upload.uploadDir}`);
      console.log(`📹 生成目录: ${config.upload.generatedDir}`);
      console.log('⚡ Socket.IO已启用');
    });
  }
}

module.exports = App;