// src/routes/batch.js
const express = require('express');
const router = express.Router();
const BatchController = require('../controllers/BatchController');
const { authenticateToken } = require('../middleware/auth');
const { apiSecurity, validateInput } = require('../middleware/security');

// 获取批量模板列表 (必须在 /batch/:batchId 之前)
router.get('/batch/templates', apiSecurity, BatchController.getTemplates);

// 创建自定义模板
router.post('/batch/templates', authenticateToken, validateInput, BatchController.createTemplate);

// 获取批量服务统计 (必须在 /batch/:batchId 之前)
router.get('/batch/stats', authenticateToken, BatchController.getStats);

// 获取用户的批量任务列表
router.get('/batches', authenticateToken, BatchController.getUserBatches);

// 创建批量任务
router.post('/batch', authenticateToken, apiSecurity, validateInput, BatchController.createBatch);

// 获取批量任务状态 (参数化路由放在最后)
router.get('/batch/:batchId', authenticateToken, BatchController.getBatchStatus);

// 取消批量任务
router.post('/batch/:batchId/cancel', authenticateToken, BatchController.cancelBatch);

module.exports = router;
