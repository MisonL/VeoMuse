// src/controllers/ModelController.js
const ModelService = require('../services/ModelService');

class ModelController {
  // 获取可用模型列表
  static async getAvailableModels(req, res) {
    try {
      const { apiKey } = req.query;

      const modelsData = await ModelService.getAvailableModels(apiKey);

      // 合并视频模型和优化模型为一个列表
      const allModels = [
        ...(modelsData.videoModels || []),
        ...(modelsData.textModels || [])
      ];

      res.json({
        success: true,
        models: allModels,
        videoModels: modelsData.videoModels || [],
        textModels: modelsData.textModels || []
      });
    } catch (error) {
      console.error('Get models error:', error);

      // 即使出错也返回默认模型
      const defaultModels = ModelService.getDefaultModels();
      const allModels = [
        ...(defaultModels.videoModels || []),
        ...(defaultModels.textModels || [])
      ];

      res.status(200).json({
        success: true,
        models: allModels,
        videoModels: defaultModels.videoModels || [],
        textModels: defaultModels.textModels || []
      });
    }
  }
}

module.exports = ModelController;