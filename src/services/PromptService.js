// src/services/PromptService.js
const axios = require('axios');
const ApiKeyService = require('./ApiKeyService');

class PromptService {
  static async optimizePrompt(prompt, apiKey, model = 'gemini-1.5-flash') {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    try {
      const availableKeys = ApiKeyService.getAvailableKeys(apiKey);
      let lastError = null;

      for (const key of availableKeys) {
        try {
          const requestData = {
            contents: [{
              parts: [{
                text: `请优化以下视频生成提示词，使其更加详细和富有表现力，包含场景、动作、风格、相机运动等元素：\n\n${prompt}`
              }]
            }]
          };

          const response = await axios.post(`${API_URL}?key=${key}`, requestData, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          const optimizedPrompt = response.data.candidates[0].content.parts[0].text;
          console.log('提示词优化成功');
          
          return optimizedPrompt;

        } catch (error) {
          lastError = error;
          console.log(`API密钥 ${key.substring(0, 10)}... 失败:`, error.message);
          continue;
        }
      }

      throw lastError || new Error('所有API密钥都已失效');

    } catch (error) {
      console.error('提示词优化失败:', error);
      throw new Error(`提示词优化失败: ${error.message}`);
    }
  }
}

module.exports = PromptService;