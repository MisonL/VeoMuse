// src/services/SecurityService.js
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

class SecurityService {
  constructor() {
    // 加密配置
    this.algorithm = 'aes-256-cbc';
    this.secretKey = process.env.ENCRYPTION_KEY || this.generateSecretKey();
    
    // 请求记录
    this.requestLog = new Map();
    this.blockedIPs = new Set();
    
    console.log('SecurityService 初始化完成');
  }

  // 生成随机密钥
  generateSecretKey() {
    const key = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️  使用临时加密密钥，建议在环境变量中设置 ENCRYPTION_KEY');
    return key;
  }

  // 加密API密钥
  encryptApiKey(apiKey) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.secretKey);
      
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 将IV和加密数据组合
      const result = iv.toString('hex') + ':' + encrypted;
      
      return result;
    } catch (error) {
      console.error('API密钥加密失败:', error);
      throw new Error('API密钥加密失败');
    }
  }

  // 解密API密钥
  decryptApiKey(encryptedKey) {
    try {
      const parts = encryptedKey.split(':');
      if (parts.length !== 2) {
        throw new Error('无效的加密格式');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = parts[1];
      
      const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('API密钥解密失败:', error);
      throw new Error('API密钥解密失败');
    }
  }

  // 验证API密钥格式
  validateApiKeyFormat(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API密钥不能为空' };
    }
    
    // 基本格式验证
    if (apiKey.length < 20) {
      return { valid: false, error: 'API密钥格式无效' };
    }
    
    // Google API密钥通常以 'AI' 开头
    if (!apiKey.startsWith('AI')) {
      return { valid: false, error: 'API密钥格式无效' };
    }
    
    return { valid: true };
  }

  // 创建基础限流中间件
  createBasicRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100, // 每15分钟最多100个请求
      message: {
        error: '请求过于频繁，请稍后再试',
        retryAfter: '15分钟'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  // 创建严格限流中间件（用于API调用）
  createStrictRateLimit() {
    const { ipKeyGenerator } = require('express-rate-limit');
    
    return rateLimit({
      windowMs: 60 * 1000, // 1分钟
      max: 10, // 每分钟最多10个请求
      message: {
        error: 'API调用过于频繁，请稍后再试',
        retryAfter: '1分钟'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // 使用express-rate-limit的IPv6兼容IP生成器
        const ip = ipKeyGenerator(req);
        return ip + ':' + (req.headers['user-id'] || 'anonymous');
      }
    });
  }

  // 创建上传限流中间件
  createUploadRateLimit() {
    return rateLimit({
      windowMs: 5 * 60 * 1000, // 5分钟
      max: 5, // 每5分钟最多5个上传请求
      message: {
        error: '文件上传过于频繁，请稍后再试',
        retryAfter: '5分钟'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  // IP黑名单检查中间件
  createIPBlacklistMiddleware() {
    return (req, res, next) => {
      const clientIP = this.getClientIP(req);
      
      if (this.blockedIPs.has(clientIP)) {
        console.log(`阻止黑名单IP访问: ${clientIP}`);
        return res.status(403).json({
          error: '访问被拒绝',
          code: 'IP_BLOCKED'
        });
      }
      
      next();
    };
  }

  // 获取客户端真实IP
  getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
  }

  // 添加IP到黑名单
  blockIP(ip, reason = '') {
    this.blockedIPs.add(ip);
    console.log(`IP已加入黑名单: ${ip} - 原因: ${reason}`);
  }

  // 移除IP黑名单
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    console.log(`IP已从黑名单移除: ${ip}`);
  }

  // 请求日志记录中间件
  createRequestLogMiddleware() {
    return (req, res, next) => {
      const clientIP = this.getClientIP(req);
      const timestamp = new Date().toISOString();
      const method = req.method;
      const path = req.path;
      const userAgent = req.headers['user-agent'] || '';
      
      // 记录请求信息
      const logEntry = {
        timestamp,
        ip: clientIP,
        method,
        path,
        userAgent,
        headers: {
          'content-type': req.headers['content-type'],
          'authorization': req.headers['authorization'] ? '[REDACTED]' : undefined
        }
      };
      
      // 保存日志（这里可以扩展为写入文件或数据库）
      console.log(`[${timestamp}] ${clientIP} - ${method} ${path}`);
      
      // 检测可疑行为
      this.detectSuspiciousActivity(req, clientIP);
      
      next();
    };
  }

  // 检测可疑活动
  detectSuspiciousActivity(req, clientIP) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1分钟窗口
    
    // 获取该IP的请求历史
    if (!this.requestLog.has(clientIP)) {
      this.requestLog.set(clientIP, []);
    }
    
    const requests = this.requestLog.get(clientIP);
    
    // 清理过期记录
    const validRequests = requests.filter(time => now - time < windowMs);
    
    // 添加当前请求
    validRequests.push(now);
    this.requestLog.set(clientIP, validRequests);
    
    // 检测异常高频请求
    if (validRequests.length > 30) { // 1分钟内超过30个请求
      console.warn(`检测到异常高频请求: ${clientIP} - ${validRequests.length}个请求/分钟`);
      this.blockIP(clientIP, '异常高频请求');
    }
    
    // 检测可疑的用户代理
    const userAgent = req.headers['user-agent'] || '';
    const suspiciousPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /python/i, /curl/i, /wget/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      console.warn(`检测到可疑用户代理: ${clientIP} - ${userAgent}`);
      // 可以选择阻止或标记
    }
  }

  // 清理过期数据
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    // 清理请求日志
    for (const [ip, requests] of this.requestLog.entries()) {
      const validRequests = requests.filter(time => now - time < maxAge);
      if (validRequests.length === 0) {
        this.requestLog.delete(ip);
      } else {
        this.requestLog.set(ip, validRequests);
      }
    }
    
    console.log('安全服务清理完成');
  }

  // 生成安全令牌
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // 哈希密码
  hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  // 验证密码
  verifyPassword(password, hash, salt) {
    const { hash: newHash } = this.hashPassword(password, salt);
    return newHash === hash;
  }

  // 获取安全统计
  getSecurityStats() {
    return {
      blockedIPs: this.blockedIPs.size,
      activeRequestLogs: this.requestLog.size,
      totalRequests: Array.from(this.requestLog.values())
        .reduce((total, requests) => total + requests.length, 0)
    };
  }
}

// 单例模式
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new SecurityService();
  }
  return instance;
}

module.exports = {
  SecurityService,
  getInstance
};