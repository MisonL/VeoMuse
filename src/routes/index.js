// src/routes/index.js
const express = require('express');
const router = express.Router();

const videoRoutes = require('./video');
const modelRoutes = require('./models');
const operationRoutes = require('./operations');
const authRoutes = require('./auth');

// 健康检查端点
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 挂载子路由
router.use('/api', videoRoutes);
router.use('/api', modelRoutes);
router.use('/api', operationRoutes);
router.use('/auth', authRoutes);

module.exports = router;