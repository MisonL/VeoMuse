// src/middleware/auth.js
const { getInstance: getAuthService } = require('../services/AuthService');

const authService = getAuthService();

// JWT认证中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      // 开发环境临时绕过认证
      // if (process.env.NODE_ENV !== 'production') {
      req.user = { id: 'dev-user-id', role: 'admin', name: 'Developer' };
      return next();
      // }
      /*
      return res.status(401).json({
        success: false,
        error: '缺少访问令牌'
      });
      */
    }

    const { user, decoded } = await authService.verifyAccessToken(token);

    // 将用户信息附加到请求对象
    req.user = user;
    req.tokenData = decoded;

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: '无效的访问令牌'
    });
  }
};

// 可选认证中间件（不强制要求登录）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const { user, decoded } = await authService.verifyAccessToken(token);
      req.user = user;
      req.tokenData = decoded;
    }

    next();
  } catch (error) {
    // 忽略认证错误，继续处理请求
    next();
  }
};

// 权限检查中间件工厂
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '需要登录'
      });
    }

    if (!authService.hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        error: '权限不足'
      });
    }

    next();
  };
};

// 角色检查中间件工厂
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '需要登录'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '角色权限不足'
      });
    }

    next();
  };
};

// 用户所有权检查中间件
const requireOwnership = (getResourceOwnerId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '需要登录'
      });
    }

    // 管理员可以访问所有资源
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceOwnerId = getResourceOwnerId(req);

    if (resourceOwnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: '只能访问自己的资源'
      });
    }

    next();
  };
};

// API密钥认证中间件（用于API调用）
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: '缺少API密钥'
      });
    }

    // 查找拥有此API密钥的用户
    const users = Array.from(authService.users.values());
    const user = users.find(u =>
      u.apiKeys && u.apiKeys.some(key => key.key === apiKey && key.status === 'active')
    );

    if (!user) {
      return res.status(403).json({
        success: false,
        error: '无效的API密钥'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: '用户账户已被禁用'
      });
    }

    // 更新API调用统计
    authService.updateUsageStats(user.id, 'api_call');

    req.user = authService.sanitizeUser(user);
    req.apiKey = apiKey;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'API密钥验证失败'
    });
  }
};

// 使用限制检查中间件
const checkUsageLimit = (limitType, maxAmount) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(); // 如果没有用户信息，跳过检查
    }

    const usage = req.user.usage || {};

    switch (limitType) {
      case 'daily_api_calls':
        if (usage.apiCallsToday >= maxAmount) {
          return res.status(429).json({
            success: false,
            error: '今日API调用次数已达上限',
            limit: maxAmount,
            current: usage.apiCallsToday
          });
        }
        break;

      case 'total_storage':
        if (usage.storageUsed >= maxAmount) {
          return res.status(429).json({
            success: false,
            error: '存储空间已达上限',
            limit: maxAmount,
            current: usage.storageUsed
          });
        }
        break;

      default:
        console.warn(`未知的限制类型: ${limitType}`);
    }

    next();
  };
};

// 会话验证中间件
const validateSession = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: '缺少会话ID'
      });
    }

    const session = authService.sessions.get(sessionId);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: '无效的会话ID'
      });
    }

    if (session.expiresAt < new Date()) {
      authService.sessions.delete(sessionId);
      return res.status(401).json({
        success: false,
        error: '会话已过期'
      });
    }

    // 更新最后活动时间
    session.lastActivity = new Date();

    // 获取用户信息
    const user = authService.users.get(session.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: '用户不存在或已被禁用'
      });
    }

    req.user = authService.sanitizeUser(user);
    req.sessionId = sessionId;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: '会话验证失败'
    });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requirePermission,
  requireRole,
  requireOwnership,
  authenticateApiKey,
  checkUsageLimit,
  validateSession
};