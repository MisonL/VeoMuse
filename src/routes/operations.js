// src/routes/operations.js
const express = require('express');
const router = express.Router();
const OperationController = require('../controllers/OperationController');
const { param } = require('express-validator'); // 引入 param

// 查询操作状态
router.get('/operation/:operationName',
  [
    param('operationName').notEmpty().withMessage('操作名称不能为空').isString().withMessage('操作名称必须是字符串').matches(/^operations\/[a-zA-Z0-9_-]+$/).withMessage('操作名称格式不正确')
  ],
  OperationController.getOperationStatus
);

// 检查操作状态 (不启动新轮询)
router.get('/operation/:operationName/status',
  [
    param('operationName').notEmpty().withMessage('操作名称不能为空')
  ],
  OperationController.checkStatus
);

module.exports = router;