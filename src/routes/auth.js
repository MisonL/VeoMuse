// src/routes/auth.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticateToken, requireRole, validateSession } = require('../middleware/auth');
const { basicSecurity, validateInput } = require('../middleware/security');

// 公开路由（不需要认证）
router.post('/register', basicSecurity, validateInput, AuthController.register);
router.post('/login', basicSecurity, validateInput, AuthController.login);
router.post('/refresh-token', basicSecurity, validateInput, AuthController.refreshToken);

// 需要认证的路由
router.post('/logout', authenticateToken, AuthController.logout);
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, validateInput, AuthController.updateProfile);
router.post('/change-password', authenticateToken, validateInput, AuthController.changePassword);

// 管理员路由
router.get('/users', authenticateToken, requireRole('admin'), AuthController.getUserList);
router.put('/users/:userId/status', authenticateToken, requireRole('admin'), validateInput, AuthController.updateUserStatus);
router.delete('/users/:userId', authenticateToken, requireRole('admin'), AuthController.deleteUser);

// 会话管理
router.get('/sessions', authenticateToken, AuthController.getUserSessions);
router.delete('/sessions/:sessionId', authenticateToken, AuthController.deleteSession);

// 认证统计（管理员）
router.get('/stats', authenticateToken, requireRole('admin'), AuthController.getAuthStats);

module.exports = router;