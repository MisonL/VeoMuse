// src/routes/operations.js
const express = require('express');
const router = express.Router();
const OperationController = require('../controllers/OperationController');

// 查询操作状态
router.get('/operation/:operationName', OperationController.getOperationStatus);

module.exports = router;