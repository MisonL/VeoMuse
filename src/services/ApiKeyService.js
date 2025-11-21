// src/services/ApiKeyService.js
const config = require('../../config'); // 引入 config

class ApiKeyService {
  static getAvailableKeys() { // 移除了 sessionApiKey 参数
    const apiKeyList = config.apiKeys.gemini;

    if (apiKeyList.length === 0) {
      console.warn('警告: 未找到任何配置的 Gemini API 密钥。');
      throw new Error('没有可用的Gemini API密钥。请在环境变量中设置 GEMINI_API_KEY 或 GEMINI_API_KEYS。');
    }
    
    return apiKeyList;
  }

  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // 基本格式验证 (Google API Key通常以 "AI" 开头，长度较长)
    return apiKey.length > 10 && apiKey.startsWith('AI');
  }

  static maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 10) {
      return '***';
    }
    return apiKey.substring(0, 10) + '...';
  }
}

module.exports = ApiKeyService;