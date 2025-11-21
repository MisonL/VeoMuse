// config.js - 应用配置文件
require('dotenv').config(); // 加载 .env 文件中的环境变量

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 5173,
    host: process.env.HOST || 'localhost'
  },

  // Gemini API 密钥配置
  apiKeys: {
    gemini: process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',').map(key => key.trim()).filter(key => key) :
      (process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY.trim()] : [])
  },

  // 文件上传配置
  upload: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 100 * 1024 * 1024, // 默认100MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    uploadDir: process.env.UPLOAD_DIR || 'uploads/',
    generatedDir: process.env.GENERATED_DIR || 'generated/'
  },

  // 视频生成配置
  video: {
    defaultModel: process.env.DEFAULT_VIDEO_MODEL || 'veo-3.1-generate-001',
    defaultOptimizationModel: process.env.DEFAULT_OPTIMIZATION_MODEL || 'gemini-2.5-flash',
    pollingInterval: parseInt(process.env.VIDEO_POLLING_INTERVAL) || 10000, // 默认10秒
    maxRetries: parseInt(process.env.MAX_API_RETRIES) || 3 // 默认最大重试次数
  },

  // 文件清理配置
  cleanup: {
    maxFileAge: parseInt(process.env.MAX_FILE_AGE) || 2 * 24 * 60 * 60 * 1000, // 默认2天
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 24 * 60 * 60 * 1000 // 默认24小时
  },

  // GPU支持配置
  gpu: {
    nvidia: process.env.GPU_NVIDIA === 'true',
    intel: process.env.GPU_INTEL === 'true',
    amd: process.env.GPU_AMD === 'true'
  },

  // CORS 配置
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o) : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3001',
      'https://veomuse.com'
    ]
  }
};