// src/controllers/ModelController.js
const ModelService = require('../services/ModelService');

class ModelController {
  // 获取可用模型列表
  static async getAvailableModels(req, res) {
    try {
      const { apiKey } = req.query;
      
      const models = await ModelService.getAvailableModels(apiKey);
      
      res.json({ 
        success: true, 
        models 
      });
    } catch (error) {
      console.error('Get models error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        models: ModelService.getDefaultModels()
      });
    }
  }
}

module.exports = ModelController;