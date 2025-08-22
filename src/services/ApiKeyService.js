// src/services/ApiKeyService.js
class ApiKeyService {
  static getAvailableKeys(sessionApiKey = null) {
    // 如果会话中有临时API密钥，优先使用
    if (sessionApiKey) {
      return [sessionApiKey];
    }
    
    // 从环境变量中获取API密钥列表
    const apiKeyList = [];
    
    // 检查GEMINI_API_KEYS（多个密钥，逗号分隔）
    if (process.env.GEMINI_API_KEYS) {
      const keys = process.env.GEMINI_API_KEYS.split(',')
                      .map(key => key.trim())
                      .filter(key => key);
      apiKeyList.push(...keys);
    }
    
    // 检查单个API密钥作为后备
    if (process.env.GEMINI_API_KEY) {
      const singleKey = process.env.GEMINI_API_KEY.trim();
      if (singleKey && !apiKeyList.includes(singleKey)) {
        apiKeyList.push(singleKey);
      }
    }
    
    return apiKeyList;
  }

  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // 基本格式验证
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