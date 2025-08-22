// src/controllers/AuthController.js
const { getInstance: getAuthService } = require('../services/AuthService');
const { validationResult } = require('express-validator');

const authService = getAuthService();

class AuthController {
  // 用户注册
  static async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { username, email, password, inviteCode } = req.body;

      // 检查邀请码（如果启用邀请制）
      if (process.env.REQUIRE_INVITE_CODE === 'true' && !inviteCode) {
        return res.status(400).json({
          success: false,
          error: '需要邀请码才能注册'
        });
      }

      const user = await authService.register({
        username,
        email,
        password,
        role: 'user' // 默认角色
      });

      res.status(201).json({
        success: true,
        message: '注册成功',
        user
      });

    } catch (error) {
      console.error('注册失败:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // 用户登录
  static async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { username, password, rememberMe } = req.body;

      const loginResult = await authService.login({
        username,
        password
      });

      // 设置Cookie（如果选择记住我）
      if (rememberMe) {
        res.cookie('sessionId', loginResult.sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 30 * 24 * 60 * 60 * 1000 // 30天
        });
      }

      res.json({
        success: true,
        message: '登录成功',
        ...loginResult
      });

    } catch (error) {
      console.error('登录失败:', error);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  // 刷新令牌
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: '缺少刷新令牌'
        });
      }

      const result = await authService.refreshToken(refreshToken);

      res.json({
        success: true,
        message: '令牌刷新成功',
        ...result
      });

    } catch (error) {
      console.error('令牌刷新失败:', error);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  // 用户登出
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const sessionId = req.sessionId || req.cookies?.sessionId;

      await authService.logout(sessionId, refreshToken);

      // 清除Cookie
      res.clearCookie('sessionId');

      res.json({
        success: true,
        message: '登出成功'
      });

    } catch (error) {
      console.error('登出失败:', error);
      res.status(500).json({
        success: false,
        error: '登出失败'
      });
    }
  }

  // 获取用户资料
  static async getProfile(req, res) {
    try {
      res.json({
        success: true,
        user: req.user
      });
    } catch (error) {
      console.error('获取用户资料失败:', error);
      res.status(500).json({
        success: false,
        error: '获取用户资料失败'
      });
    }
  }

  // 更新用户资料
  static async updateProfile(req, res) {
    try {
      const { email, profile, preferences } = req.body;
      const userId = req.user.id;

      const updatedUser = await authService.updateUser(userId, {
        email,
        profile,
        preferences
      });

      res.json({
        success: true,
        message: '资料更新成功',
        user: updatedUser
      });

    } catch (error) {
      console.error('更新用户资料失败:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // 修改密码
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: '当前密码和新密码不能为空'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: '新密码长度至少6位'
        });
      }

      await authService.updateUser(userId, {
        currentPassword,
        password: newPassword
      });

      res.json({
        success: true,
        message: '密码修改成功'
      });

    } catch (error) {
      console.error('修改密码失败:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // 获取用户列表（管理员）
  static async getUserList(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {
        role: req.query.role,
        status: req.query.status,
        search: req.query.search
      };

      const result = authService.getUserList(page, limit, filters);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      console.error('获取用户列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取用户列表失败'
      });
    }
  }

  // 更新用户状态（管理员）
  static async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status, role } = req.body;

      const user = authService.users.get(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }

      // 更新状态
      if (status !== undefined) {
        user.status = status;
      }

      // 更新角色
      if (role !== undefined) {
        user.role = role;
        user.permissions = authService.getDefaultPermissions(role);
      }

      user.updatedAt = new Date();

      res.json({
        success: true,
        message: '用户状态更新成功',
        user: authService.sanitizeUser(user)
      });

    } catch (error) {
      console.error('更新用户状态失败:', error);
      res.status(500).json({
        success: false,
        error: '更新用户状态失败'
      });
    }
  }

  // 删除用户（管理员）
  static async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      if (userId === req.user.id) {
        return res.status(400).json({
          success: false,
          error: '不能删除自己的账户'
        });
      }

      const user = authService.users.get(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: '用户不存在'
        });
      }

      // 删除用户
      authService.users.delete(userId);

      // 清理相关的会话和令牌
      for (const [sessionId, session] of authService.sessions.entries()) {
        if (session.userId === userId) {
          authService.sessions.delete(sessionId);
        }
      }

      for (const [token, tokenData] of authService.refreshTokens.entries()) {
        if (tokenData.userId === userId) {
          authService.refreshTokens.delete(token);
        }
      }

      res.json({
        success: true,
        message: '用户删除成功'
      });

    } catch (error) {
      console.error('删除用户失败:', error);
      res.status(500).json({
        success: false,
        error: '删除用户失败'
      });
    }
  }

  // 获取用户会话列表
  static async getUserSessions(req, res) {
    try {
      const userId = req.user.id;
      const userSessions = [];

      for (const [sessionId, session] of authService.sessions.entries()) {
        if (session.userId === userId) {
          userSessions.push({
            sessionId,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt
          });
        }
      }

      res.json({
        success: true,
        sessions: userSessions
      });

    } catch (error) {
      console.error('获取会话列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取会话列表失败'
      });
    }
  }

  // 删除指定会话
  static async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = authService.sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: '会话不存在'
        });
      }

      // 检查会话所有权
      if (session.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: '无权删除此会话'
        });
      }

      authService.sessions.delete(sessionId);

      res.json({
        success: true,
        message: '会话删除成功'
      });

    } catch (error) {
      console.error('删除会话失败:', error);
      res.status(500).json({
        success: false,
        error: '删除会话失败'
      });
    }
  }

  // 获取认证统计（管理员）
  static async getAuthStats(req, res) {
    try {
      const stats = authService.getAuthStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('获取认证统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取认证统计失败'
      });
    }
  }
}

module.exports = AuthController;