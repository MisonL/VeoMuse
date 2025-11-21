// src/controllers/OperationController.js
const OperationService = require('../services/OperationService');

class OperationController {
  // 查询操作状态
  static async getOperationStatus(req, res) {
    try {
      const { operationName } = req.params;
      const { apiKey } = req.query;
      const socketId = req.headers['socket-id'];

      if (!operationName) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数'
        });
      }

      const status = await OperationService.getOperationStatus({
        operationName,
        apiKey,
        socketId
      });

      res.json(status);
    } catch (error) {
      console.error('Operation status error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // 检查操作状态 (不启动新轮询)
  static async checkStatus(req, res) {
    try {
      const { operationName } = req.params;

      if (!operationName) {
        return res.status(400).json({
          success: false,
          error: '缺少操作名称'
        });
      }

      const status = await OperationService.checkStatus(operationName);
      res.json(status);
    } catch (error) {
      console.error('Check status error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = OperationController;