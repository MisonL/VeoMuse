// src/middleware/security.js
const { getInstance: getSecurityService } = require('../services/SecurityService');

const securityService = getSecurityService();

// 基础安全中间件
const basicSecurity = [
  securityService.createRequestLogMiddleware(),
  securityService.createIPBlacklistMiddleware(),
  securityService.createBasicRateLimit()
];

// API调用安全中间件
const apiSecurity = [
  ...basicSecurity,
  securityService.createStrictRateLimit()
];

// 文件上传安全中间件  
const uploadSecurity = [
  ...basicSecurity,
  securityService.createUploadRateLimit()
];

// API密钥验证中间件
const validateApiKey = (req, res, next) => {
  const apiKey = req.body.apiKey || req.query.apiKey || req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: '缺少API密钥'
    });
  }
  
  const validation = securityService.validateApiKeyFormat(apiKey);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }
  
  // 将验证后的API密钥附加到请求对象
  req.validatedApiKey = apiKey;
  next();
};

// 输入验证中间件
const validateInput = (req, res, next) => {
  // 检查请求体大小
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 50 * 1024 * 1024) {
    return res.status(413).json({
      success: false,
      error: '请求体过大'
    });
  }
  
  // 检查常见的恶意输入模式
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /document\./i,
    /eval\(/i
  ];
  
  const checkString = (str) => {
    if (typeof str === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(str));
    }
    return false;
  };
  
  const checkObject = (obj) => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (checkString(obj[key]) || checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkObject(req.body) || checkObject(req.query)) {
    return res.status(400).json({
      success: false,
      error: '检测到潜在的恶意输入'
    });
  }
  
  next();
};

// CORS安全配置
const corsOptions = {
  origin: function (origin, callback) {
    // 允许的域名列表
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://veomuse.com' // 生产域名
    ];
    
    // 开发环境或无origin（本地文件、curl等）
    if (process.env.NODE_ENV === 'development' || !origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`拒绝的CORS origin: ${origin}`);
      callback(null, true); // 临时允许所有origin，生产环境应严格控制
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = {
  basicSecurity,
  apiSecurity,
  uploadSecurity,
  validateApiKey,
  validateInput,
  corsOptions,
  securityService
};