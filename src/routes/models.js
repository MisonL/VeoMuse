// src/routes/models.js
const express = require('express');
const router = express.Router();
const ModelController = require('../controllers/ModelController');

// 获取可用模型列表
router.get('/models', ModelController.getAvailableModels);

module.exports = router;