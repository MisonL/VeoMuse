// src/controllers/OperationController.js
const OperationService = require('../services/OperationService');

class OperationController {
  // 查询操作状态
  static async getOperationStatus(req, res) {
    try {
      const { operationName } = req.params;
      const { apiKey } = req.query;
      const socketId = req.headers['socket-id'];

      if (!operationName || !apiKey) {
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
}

module.exports = OperationController;