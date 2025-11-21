// src/services/ModelService.js
const axios = require('axios');
const config = require('../../config');
const ApiKeyService = require('./ApiKeyService');

class ModelService {
  static async getAvailableModels(apiKey) {
    try {
      const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
      const availableKeys = ApiKeyService.getAvailableKeys(apiKey);
      
      if (availableKeys.length === 0) {
        return this.getDefaultModels();
      }

      // 使用第一个可用的API密钥
      const key = availableKeys[0];
      
      const response = await axios.get(`${API_URL}?key=${key}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const models = response.data.models || [];
      
      // 分类模型
      const videoModels = models.filter(model => 
        model.name && (model.name.includes('veo') || model.name.includes('video'))
      ).map(model => ({
        name: model.name.split('/').pop(),
        displayName: model.displayName || model.name,
        description: model.description || '视频生成模型'
      }));

      const textModels = models.filter(model => 
        model.name && (
          model.name.includes('gemini') || 
          model.name.includes('flash') || 
          model.name.includes('pro')
        ) && !model.name.includes('veo')
      ).map(model => {
        // 根据模型名称设置正确的显示名称和描述，覆盖API返回的displayName
        let displayName = model.name;
        let description = '文本生成模型';
        
        // 更新Gemini 2.5模型的显示名称
        if (model.name.includes('gemini-2.0')) {
          displayName = 'Gemini 2.0 Flash';
          description = '快速文本生成模型';
        } else if (model.name.includes('gemini-2.5') && model.name.includes('flash')) {
          displayName = 'Gemini 2.5 Flash';
          description = '快速文本生成模型';
        } else if (model.name.includes('gemini-2.5') && model.name.includes('pro')) {
          displayName = 'Gemini 2.5 Pro';
          description = '高质量文本生成模型';
        } else if (model.name.includes('gemini-1.5') && model.name.includes('flash')) {
          displayName = 'Gemini 1.5 Flash';
          description = '快速文本生成模型';
        } else if (model.name.includes('gemini-1.5') && model.name.includes('pro')) {
          displayName = 'Gemini 1.5 Pro';
          description = '高质量文本生成模型';
        }
        
        return {
          name: model.name.split('/').pop(),
          displayName: displayName,
          description: description
        };
      });

      return {
        videoModels: videoModels.length > 0 ? videoModels : this.getDefaultModels().videoModels,
        textModels: textModels.length > 0 ? textModels : this.getDefaultModels().textModels
      };

    } catch (error) {
      console.log('获取模型列表失败，使用默认配置:', error.message);
      return this.getDefaultModels();
    }
  }

  static getDefaultModels() {
    return {
      videoModels: [
        {
          name: 'veo-3.1-generate-001',
          displayName: 'Veo 3.1',
          description: '最新一代高保真视频生成模型'
        },
        {
          name: 'veo-3.1-fast-generate-001',
          displayName: 'Veo 3.1 Fast',
          description: '快速视频生成模型'
        },
        {
          name: 'veo-3.0-generate-001',
          displayName: 'Veo 3.0',
          description: '高质量视频生成模型'
        },
        {
          name: 'veo-3.0-fast-generate-001',
          displayName: 'Veo 3.0 Fast',
          description: '快速视频生成模型'
        },
        {
          name: config.video.defaultModel,
          displayName: 'Veo 3.0 Preview',
          description: '预览版视频生成模型'
        }
      ],
      textModels: [
        {
          name: config.video.defaultOptimizationModel,
          displayName: 'Gemini 2.5 Flash',
          description: '快速文本生成模型'
        },
        {
          name: 'gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          description: '高质量文本生成模型'
        },
        {
          name: 'gemini-1.5-flash',
          displayName: 'Gemini 1.5 Flash',
          description: '快速文本生成模型'
        },
        {
          name: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro',
          description: '高质量文本生成模型'
        }
      ]
    };
  }
}

module.exports = ModelService;