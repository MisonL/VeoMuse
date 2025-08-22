// src/services/AuthService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecret();
    this.jwtExpires = process.env.JWT_EXPIRES || '7d';
    this.refreshTokenExpires = process.env.REFRESH_TOKEN_EXPIRES || '30d';
    
    // 内存存储（生产环境应使用数据库）
    this.users = new Map();
    this.refreshTokens = new Map();
    this.sessions = new Map();
    
    // 创建默认管理员用户
    this.createDefaultAdmin();
    
    console.log('AuthService 初始化完成');
  }

  generateSecret() {
    const secret = crypto.randomBytes(64).toString('hex');
    console.warn('⚠️  使用临时JWT密钥，建议在环境变量中设置 JWT_SECRET');
    return secret;
  }

  async createDefaultAdmin() {
    const adminExists = Array.from(this.users.values()).some(user => user.role === 'admin');
    
    if (!adminExists) {
      const defaultAdmin = {
        id: 'admin_' + Date.now(),
        username: 'admin',
        email: 'admin@veomuse.com',
        password: await this.hashPassword('admin123'),
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: null,
        permissions: ['all']
      };
      
      this.users.set(defaultAdmin.id, defaultAdmin);
      console.log('✅ 默认管理员账户已创建 - 用户名: admin, 密码: admin123');
    }
  }

  // 用户注册
  async register(userData) {
    const { username, email, password, role = 'user' } = userData;

    // 验证输入
    if (!username || !email || !password) {
      throw new Error('用户名、邮箱和密码不能为空');
    }

    // 检查用户名是否已存在
    const existingUser = Array.from(this.users.values())
      .find(user => user.username === username || user.email === email);
    
    if (existingUser) {
      throw new Error('用户名或邮箱已存在');
    }

    // 密码强度验证
    if (password.length < 6) {
      throw new Error('密码长度至少6位');
    }

    // 创建新用户
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const hashedPassword = await this.hashPassword(password);

    const newUser = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      role,
      status: 'active',
      createdAt: new Date(),
      lastLoginAt: null,
      profile: {
        displayName: username,
        avatar: null,
        bio: '',
        preferences: {
          theme: 'light',
          language: 'zh-CN'
        }
      },
      permissions: this.getDefaultPermissions(role),
      apiKeys: [], // 用户的API密钥
      usage: {
        videosGenerated: 0,
        storageUsed: 0,
        apiCallsToday: 0,
        lastResetDate: new Date().toDateString()
      }
    };

    this.users.set(userId, newUser);

    console.log(`新用户注册: ${username} (${email})`);

    // 返回用户信息（不包含密码）
    return this.sanitizeUser(newUser);
  }

  // 用户登录
  async login(credentials) {
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('用户名和密码不能为空');
    }

    // 查找用户
    const user = Array.from(this.users.values())
      .find(u => u.username === username || u.email === username);

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.status !== 'active') {
      throw new Error('账户已被禁用');
    }

    // 验证密码
    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('密码错误');
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date();

    // 生成令牌
    const tokens = await this.generateTokens(user);

    // 创建会话
    const sessionId = this.createSession(user.id, tokens.accessToken);

    console.log(`用户登录: ${user.username}`);

    return {
      user: this.sanitizeUser(user),
      tokens,
      sessionId
    };
  }

  // 刷新令牌
  async refreshToken(refreshToken) {
    if (!this.refreshTokens.has(refreshToken)) {
      throw new Error('无效的刷新令牌');
    }

    const tokenData = this.refreshTokens.get(refreshToken);
    
    if (tokenData.expiresAt < new Date()) {
      this.refreshTokens.delete(refreshToken);
      throw new Error('刷新令牌已过期');
    }

    const user = this.users.get(tokenData.userId);
    if (!user || user.status !== 'active') {
      throw new Error('用户不存在或已被禁用');
    }

    // 生成新令牌
    const newTokens = await this.generateTokens(user);

    // 删除旧的刷新令牌
    this.refreshTokens.delete(refreshToken);

    return {
      user: this.sanitizeUser(user),
      tokens: newTokens
    };
  }

  // 用户登出
  async logout(sessionId, refreshToken) {
    // 删除会话
    if (sessionId && this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
    }

    // 删除刷新令牌
    if (refreshToken && this.refreshTokens.has(refreshToken)) {
      this.refreshTokens.delete(refreshToken);
    }

    console.log('用户已登出');
  }

  // 验证访问令牌
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = this.users.get(decoded.userId);

      if (!user || user.status !== 'active') {
        throw new Error('用户不存在或已被禁用');
      }

      return {
        user: this.sanitizeUser(user),
        decoded
      };
    } catch (error) {
      throw new Error('无效的访问令牌');
    }
  }

  // 生成令牌
  async generateTokens(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpires
    });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30天

    // 存储刷新令牌
    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt: refreshTokenExpiry,
      createdAt: new Date()
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpires
    };
  }

  // 创建会话
  createSession(userId, accessToken) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24小时

    this.sessions.set(sessionId, {
      userId,
      accessToken,
      createdAt: new Date(),
      expiresAt,
      lastActivity: new Date()
    });

    return sessionId;
  }

  // 密码哈希
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // 密码验证
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // 获取默认权限
  getDefaultPermissions(role) {
    const permissions = {
      admin: ['all'],
      moderator: [
        'video:generate', 'video:view', 'video:edit', 'video:delete',
        'user:view', 'analytics:view'
      ],
      user: [
        'video:generate', 'video:view', 'video:edit',
        'profile:edit'
      ],
      guest: [
        'video:view'
      ]
    };

    return permissions[role] || permissions.guest;
  }

  // 检查权限
  hasPermission(user, permission) {
    if (!user || !user.permissions) {
      return false;
    }

    // 管理员拥有所有权限
    if (user.permissions.includes('all')) {
      return true;
    }

    return user.permissions.includes(permission);
  }

  // 清理用户信息（移除敏感数据）
  sanitizeUser(user) {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  // 更新用户信息
  async updateUser(userId, updateData) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 可更新的字段
    const allowedFields = ['email', 'profile', 'preferences'];
    const updates = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    }

    // 如果要更新密码
    if (updateData.password) {
      if (updateData.currentPassword) {
        const isCurrentPasswordValid = await this.verifyPassword(
          updateData.currentPassword, 
          user.password
        );
        if (!isCurrentPasswordValid) {
          throw new Error('当前密码不正确');
        }
      }
      updates.password = await this.hashPassword(updateData.password);
    }

    // 更新用户数据
    Object.assign(user, updates);
    user.updatedAt = new Date();

    console.log(`用户信息已更新: ${user.username}`);

    return this.sanitizeUser(user);
  }

  // 获取用户列表（管理员功能）
  getUserList(page = 1, limit = 20, filters = {}) {
    const users = Array.from(this.users.values());
    let filteredUsers = users;

    // 应用筛选
    if (filters.role) {
      filteredUsers = filteredUsers.filter(user => user.role === filters.role);
    }
    if (filters.status) {
      filteredUsers = filteredUsers.filter(user => user.status === filters.status);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.username.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      );
    }

    // 分页
    const total = filteredUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return {
      users: paginatedUsers.map(user => this.sanitizeUser(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // 更新用户使用统计
  updateUsageStats(userId, action, amount = 1) {
    const user = this.users.get(userId);
    if (!user) return;

    const today = new Date().toDateString();
    
    // 重置每日统计
    if (user.usage.lastResetDate !== today) {
      user.usage.apiCallsToday = 0;
      user.usage.lastResetDate = today;
    }

    switch (action) {
      case 'video_generated':
        user.usage.videosGenerated += amount;
        break;
      case 'api_call':
        user.usage.apiCallsToday += amount;
        break;
      case 'storage_used':
        user.usage.storageUsed += amount;
        break;
    }
  }

  // 清理过期数据
  cleanup() {
    const now = new Date();

    // 清理过期的刷新令牌
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.expiresAt < now) {
        this.refreshTokens.delete(token);
      }
    }

    // 清理过期的会话
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }

    console.log('AuthService 清理完成');
  }

  // 获取认证统计
  getAuthStats() {
    return {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
      activeSessions: this.sessions.size,
      activeRefreshTokens: this.refreshTokens.size
    };
  }
}

// 单例模式
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new AuthService();
  }
  return instance;
}

module.exports = {
  AuthService,
  getInstance
};