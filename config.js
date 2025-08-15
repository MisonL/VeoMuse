// config.js - 应用配置文件

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
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
    defaultModel: process.env.DEFAULT_VIDEO_MODEL || 'veo-3.0-generate-preview',
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
    // 在实际应用中，这些应该通过硬件检测来确定
    nvidia: process.platform !== 'darwin', // 非macOS系统假设支持NVIDIA
    intel: true, // 大多数系统支持Intel
    amd: process.platform === 'darwin' || process.platform === 'win32' // Mac和Windows可能支持AMD
  }
};